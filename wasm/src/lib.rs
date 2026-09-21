use std::cell::RefCell;

use wasm_bindgen::prelude::*;

const NONE: u32 = 0;
const PEAK: u32 = 1;
const LTTB: u32 = 2;
const AVERAGE: u32 = 3;
const MIN: u32 = 4;
const MAX: u32 = 5;
const MINMAX: u32 = 6;
const SUM: u32 = 7;

#[derive(Clone, Copy)]
struct Point {
    source_index: u32,
    x: f64,
    y: f64,
}

struct ExtremaLayer {
    minimum: Vec<u32>,
    maximum: Vec<u32>,
}

struct SumLayer {
    x: Vec<f64>,
    y: Vec<f64>,
    count: Vec<u32>,
}

struct StoredDataset {
    x: Option<Vec<f64>>,
    y: Vec<f64>,
    uniform_start: f64,
    uniform_step: f64,
    uniform_source_indexes: Option<Vec<u32>>,
    extrema_layers: Vec<Option<ExtremaLayer>>,
    sum_layers: Vec<Option<SumLayer>>,
    index_bytes: usize,
    index_max_bytes: usize,
}

thread_local! {
    static DATASETS: RefCell<Vec<Option<StoredDataset>>> = const { RefCell::new(Vec::new()) };
}

fn validated_points(x: &[f64], y: &[f64]) -> Result<Vec<Point>, JsValue> {
    if x.len() != y.len() {
        return Err(JsValue::from_str("x and y must have the same length"));
    }

    let mut points = Vec::with_capacity(x.len());
    let mut ordered = true;
    let mut previous_x = f64::NEG_INFINITY;
    for (source_index, (&point_x, &point_y)) in x.iter().zip(y).enumerate() {
        if !point_x.is_finite() || !point_y.is_finite() {
            continue;
        }
        if point_x < previous_x {
            ordered = false;
        }
        previous_x = point_x;
        points.push(Point {
            source_index: source_index as u32,
            x: point_x,
            y: point_y,
        });
    }

    // Rust's stable sort preserves source order when X coordinates are equal.
    if !ordered {
        points.sort_by(|left, right| left.x.partial_cmp(&right.x).unwrap());
    }
    Ok(points)
}

fn target_count(target: u32, point_count: usize) -> usize {
    if point_count == 0 {
        return 0;
    }
    point_count.min((target as usize).max(1))
}

fn bucket_bounds(bucket: usize, bucket_count: usize, start: usize, end: usize) -> (usize, usize) {
    let span = end - start;
    (
        start + (bucket * span) / bucket_count,
        start + ((bucket + 1) * span) / bucket_count,
    )
}

fn push_unique(indexes: &mut Vec<usize>, index: usize) {
    if indexes.last().copied() != Some(index) {
        indexes.push(index);
    }
}

fn endpoints_or_all(points: &[Point], target: usize) -> Option<Vec<usize>> {
    if points.len() <= target {
        return Some((0..points.len()).collect());
    }
    match target {
        0 => Some(Vec::new()),
        1 => Some(vec![0]),
        2 => Some(vec![0, points.len() - 1]),
        _ => None,
    }
}

fn extrema_indexes(points: &[Point], target: usize, strategy: u32) -> Vec<usize> {
    if let Some(indexes) = endpoints_or_all(points, target) {
        return indexes;
    }
    let bucket_count = if strategy == MINMAX {
        (target - 2) / 2
    } else {
        target - 2
    };
    if bucket_count == 0 {
        return vec![0, points.len() - 1];
    }

    let mut indexes = vec![0];
    for bucket in 0..bucket_count {
        let (start, end) = bucket_bounds(bucket, bucket_count, 1, points.len() - 1);
        let mut minimum = start;
        let mut maximum = start;
        for index in (start + 1)..end {
            if points[index].y < points[minimum].y {
                minimum = index;
            }
            if points[index].y > points[maximum].y {
                maximum = index;
            }
        }
        match strategy {
            MIN => push_unique(&mut indexes, minimum),
            MAX => push_unique(&mut indexes, maximum),
            MINMAX if minimum <= maximum => {
                push_unique(&mut indexes, minimum);
                push_unique(&mut indexes, maximum);
            }
            MINMAX => {
                push_unique(&mut indexes, maximum);
                push_unique(&mut indexes, minimum);
            }
            _ => unreachable!(),
        }
    }
    push_unique(&mut indexes, points.len() - 1);
    indexes
}

fn peak_indexes(points: &[Point], target: usize) -> Vec<usize> {
    if let Some(indexes) = endpoints_or_all(points, target) {
        return indexes;
    }
    let bucket_count = (target - 2) / 4;
    if bucket_count == 0 {
        return vec![0, points.len() - 1];
    }

    let mut indexes = vec![0];
    for bucket in 0..bucket_count {
        let (start, end) = bucket_bounds(bucket, bucket_count, 1, points.len() - 1);
        let mut minimum = start;
        let mut maximum = start;
        for index in (start + 1)..end {
            if points[index].y < points[minimum].y {
                minimum = index;
            }
            if points[index].y > points[maximum].y {
                maximum = index;
            }
        }
        let mut bucket_indexes = [start, minimum, maximum, end - 1];
        bucket_indexes.sort_unstable();
        for index in bucket_indexes {
            push_unique(&mut indexes, index);
        }
    }
    push_unique(&mut indexes, points.len() - 1);
    indexes
}

fn lttb_indexes(points: &[Point], target: usize) -> Vec<usize> {
    if let Some(indexes) = endpoints_or_all(points, target) {
        return indexes;
    }

    let bucket_size = (points.len() - 2) as f64 / (target - 2) as f64;
    let mut indexes = vec![0];
    let mut previous = 0;
    for bucket in 0..(target - 2) {
        let average_start =
            (((bucket + 1) as f64 * bucket_size).floor() as usize + 1).min(points.len());
        let average_end =
            (((bucket + 2) as f64 * bucket_size).floor() as usize + 1).min(points.len());
        let (mut average_x, mut average_y) = (0.0, 0.0);
        for point in &points[average_start..average_end] {
            average_x += point.x;
            average_y += point.y;
        }
        let average_count = average_end - average_start;
        if average_count > 0 {
            average_x /= average_count as f64;
            average_y /= average_count as f64;
        } else {
            average_x = points[points.len() - 1].x;
            average_y = points[points.len() - 1].y;
        }

        let (start, end) = bucket_bounds(bucket, target - 2, 1, points.len() - 1);
        let mut selected = start;
        let mut maximum_area = -1.0;
        for index in start..end {
            let area = ((points[previous].x - average_x) * (points[index].y - points[previous].y)
                - (points[previous].x - points[index].x) * (average_y - points[previous].y))
                .abs();
            if area > maximum_area {
                maximum_area = area;
                selected = index;
            }
        }
        indexes.push(selected);
        previous = selected;
    }
    indexes.push(points.len() - 1);
    indexes
}

fn source_indexes(points: &[Point], strategy: u32, target: usize) -> Result<Vec<u32>, JsValue> {
    let indexes = match strategy {
        NONE => (0..points.len()).collect(),
        PEAK => peak_indexes(points, target),
        LTTB => lttb_indexes(points, target),
        MIN | MAX | MINMAX => extrema_indexes(points, target, strategy),
        _ => return Err(JsValue::from_str("strategy does not return source indexes")),
    };
    Ok(indexes
        .into_iter()
        .map(|index| points[index].source_index)
        .collect())
}

fn aggregate(points: &[Point], target: usize, strategy: u32) -> Result<Vec<f64>, JsValue> {
    if strategy != AVERAGE && strategy != SUM {
        return Err(JsValue::from_str(
            "strategy does not return aggregate values",
        ));
    }
    let mut result = Vec::with_capacity(target * 2);
    for bucket in 0..target {
        let (start, end) = bucket_bounds(bucket, target, 0, points.len());
        let (mut x, mut y) = (0.0, 0.0);
        for point in &points[start..end] {
            x += point.x;
            y += point.y;
        }
        x /= (end - start) as f64;
        if strategy == AVERAGE {
            y /= (end - start) as f64;
        }
        result.extend([x, y]);
    }
    Ok(result)
}

fn clamp_range(length: usize, start: u32, end: u32) -> (usize, usize) {
    let range_start = (start as usize).min(length);
    let range_end = (end as usize).min(length).max(range_start);
    (range_start, range_end)
}

fn largest_aligned_block(start: usize, remaining: usize) -> usize {
    let mut size = 1;
    while size * 2 <= remaining && start % (size * 2) == 0 {
        size *= 2;
    }
    size
}

impl StoredDataset {
    fn new(x: &[f64], y: &[f64], index_max_bytes: usize) -> Result<Self, JsValue> {
        if x.len() != y.len() {
            return Err(JsValue::from_str("x and y must have the same length"));
        }
        if x.len() > u32::MAX as usize {
            return Err(JsValue::from_str("dataset has too many points"));
        }
        if x.iter()
            .zip(y)
            .any(|(&point_x, &point_y)| !point_x.is_finite() || !point_y.is_finite())
        {
            return Err(JsValue::from_str(
                "registered datasets must contain finite coordinates",
            ));
        }
        let uniform_step = if x.len() > 1 {
            (x[x.len() - 1] - x[0]) / (x.len() - 1) as f64
        } else {
            0.0
        };
        let is_uniform = x.iter().enumerate().all(|(index, value)| {
            let expected = x[0] + uniform_step * index as f64;
            (*value - expected).abs()
                <= 128.0 * f64::EPSILON * value.abs().max(expected.abs()).max(1.0)
        });
        Ok(Self {
            x: (!is_uniform).then(|| x.to_vec()),
            y: y.to_vec(),
            uniform_start: x.first().copied().unwrap_or(0.0),
            uniform_step,
            uniform_source_indexes: None,
            extrema_layers: Vec::new(),
            sum_layers: Vec::new(),
            index_bytes: 0,
            index_max_bytes,
        })
    }

    fn new_samples(
        y: &[f64],
        source_indexes: &[u32],
        start_time: f64,
        sample_rate: f64,
        index_max_bytes: usize,
    ) -> Result<Self, JsValue> {
        if !start_time.is_finite() || !sample_rate.is_finite() || sample_rate <= 0.0 {
            return Err(JsValue::from_str(
                "sample metadata must be finite and sampleRate positive",
            ));
        }
        if y.len() > u32::MAX as usize || y.iter().any(|value| !value.is_finite()) {
            return Err(JsValue::from_str(
                "sample values must be finite and addressable",
            ));
        }
        if !source_indexes.is_empty()
            && (source_indexes.len() != y.len()
                || source_indexes.windows(2).any(|pair| pair[0] > pair[1]))
        {
            return Err(JsValue::from_str(
                "source indexes must be empty or nondecreasing",
            ));
        }
        Ok(Self {
            x: None,
            y: y.to_vec(),
            uniform_start: start_time,
            uniform_step: 1.0 / sample_rate,
            uniform_source_indexes: (!source_indexes.is_empty()).then(|| source_indexes.to_vec()),
            extrema_layers: Vec::new(),
            sum_layers: Vec::new(),
            index_bytes: 0,
            index_max_bytes,
        })
    }

    fn len(&self) -> usize {
        self.y.len()
    }

    fn x_at(&self, index: usize) -> f64 {
        self.x.as_ref().map_or_else(
            || {
                let source_index = self
                    .uniform_source_indexes
                    .as_ref()
                    .map_or(index as u32, |indexes| indexes[index]);
                self.uniform_start + self.uniform_step * source_index as f64
            },
            |x| x[index],
        )
    }

    fn points_in_range(&self, start: usize, end: usize) -> Vec<Point> {
        (start..end)
            .map(|index| Point {
                source_index: index as u32,
                x: self.x_at(index),
                y: self.y[index],
            })
            .collect()
    }

    fn reserve(&mut self, bytes: usize) -> bool {
        if self.index_bytes.saturating_add(bytes) > self.index_max_bytes {
            return false;
        }
        self.index_bytes += bytes;
        true
    }

    fn is_minimum(&self, candidate: u32, current: u32) -> bool {
        self.y[candidate as usize] < self.y[current as usize]
            || (self.y[candidate as usize] == self.y[current as usize] && candidate < current)
    }

    fn is_maximum(&self, candidate: u32, current: u32) -> bool {
        self.y[candidate as usize] > self.y[current as usize]
            || (self.y[candidate as usize] == self.y[current as usize] && candidate < current)
    }

    fn ensure_extrema(&mut self, level: usize) -> bool {
        for current in 1..=level {
            if self
                .extrema_layers
                .get(current)
                .and_then(Option::as_ref)
                .is_some()
            {
                continue;
            }
            let length = self.len().div_ceil(1usize << current);
            let bytes = length.saturating_mul(2 * std::mem::size_of::<u32>());
            if !self.reserve(bytes) {
                return false;
            }
            let mut minimum = vec![0; length];
            let mut maximum = vec![0; length];
            for block in 0..length {
                let left = block * 2;
                let right = left + 1;
                let (left_minimum, left_maximum, right_minimum, right_maximum, has_right) =
                    if let Some(previous) = self
                        .extrema_layers
                        .get(current - 1)
                        .and_then(Option::as_ref)
                    {
                        (
                            previous.minimum[left],
                            previous.maximum[left],
                            if right < previous.minimum.len() {
                                previous.minimum[right]
                            } else {
                                0
                            },
                            if right < previous.maximum.len() {
                                previous.maximum[right]
                            } else {
                                0
                            },
                            right < previous.minimum.len(),
                        )
                    } else {
                        (
                            left as u32,
                            left as u32,
                            right as u32,
                            right as u32,
                            right < self.len(),
                        )
                    };
                minimum[block] = if has_right && self.is_minimum(right_minimum, left_minimum) {
                    right_minimum
                } else {
                    left_minimum
                };
                maximum[block] = if has_right && self.is_maximum(right_maximum, left_maximum) {
                    right_maximum
                } else {
                    left_maximum
                };
            }
            if self.extrema_layers.len() <= current {
                self.extrema_layers.resize_with(current + 1, || None);
            }
            self.extrema_layers[current] = Some(ExtremaLayer { minimum, maximum });
        }
        true
    }

    fn ensure_sum(&mut self, level: usize) -> bool {
        for current in 1..=level {
            if self
                .sum_layers
                .get(current)
                .and_then(Option::as_ref)
                .is_some()
            {
                continue;
            }
            let length = self.len().div_ceil(1usize << current);
            let bytes =
                length.saturating_mul(2 * std::mem::size_of::<f64>() + std::mem::size_of::<u32>());
            if !self.reserve(bytes) {
                return false;
            }
            let mut x = vec![0.0; length];
            let mut y = vec![0.0; length];
            let mut count = vec![0; length];
            for block in 0..length {
                let left = block * 2;
                let right = left + 1;
                if let Some(previous) = self.sum_layers.get(current - 1).and_then(Option::as_ref) {
                    x[block] = previous.x[left]
                        + if right < previous.x.len() {
                            previous.x[right]
                        } else {
                            0.0
                        };
                    y[block] = previous.y[left]
                        + if right < previous.y.len() {
                            previous.y[right]
                        } else {
                            0.0
                        };
                    count[block] = previous.count[left]
                        + if right < previous.count.len() {
                            previous.count[right]
                        } else {
                            0
                        };
                } else {
                    x[block] = self.x_at(left)
                        + if right < self.len() {
                            self.x_at(right)
                        } else {
                            0.0
                        };
                    y[block] = self.y[left]
                        + if right < self.len() {
                            self.y[right]
                        } else {
                            0.0
                        };
                    count[block] = if right < self.len() { 2 } else { 1 };
                }
            }
            if self.sum_layers.len() <= current {
                self.sum_layers.resize_with(current + 1, || None);
            }
            self.sum_layers[current] = Some(SumLayer { x, y, count });
        }
        true
    }

    fn query_extrema(&mut self, start: usize, end: usize) -> Option<(u32, u32)> {
        if start >= end {
            return None;
        }
        let level = (end - start).ilog2() as usize;
        if !self.ensure_extrema(level) {
            return None;
        }
        let mut minimum = start as u32;
        let mut maximum = start as u32;
        let mut position = start;
        while position < end {
            let size = largest_aligned_block(position, end - position);
            let block_level = size.ilog2() as usize;
            let block = position / size;
            let (next_minimum, next_maximum) = if block_level == 0 {
                (position as u32, position as u32)
            } else {
                let layer = self.extrema_layers[block_level].as_ref()?;
                (layer.minimum[block], layer.maximum[block])
            };
            if self.is_minimum(next_minimum, minimum) {
                minimum = next_minimum;
            }
            if self.is_maximum(next_maximum, maximum) {
                maximum = next_maximum;
            }
            position += size;
        }
        Some((minimum, maximum))
    }

    fn query_sum(&mut self, start: usize, end: usize) -> Option<(f64, f64, u32)> {
        if start >= end {
            return None;
        }
        let level = (end - start).ilog2() as usize;
        if !self.ensure_sum(level) {
            return None;
        }
        let (mut x, mut y, mut count) = (0.0, 0.0, 0u32);
        let mut position = start;
        while position < end {
            let size = largest_aligned_block(position, end - position);
            let block_level = size.ilog2() as usize;
            let block = position / size;
            if block_level == 0 {
                x += self.x_at(position);
                y += self.y[position];
                count += 1;
            } else {
                let layer = self.sum_layers[block_level].as_ref()?;
                x += layer.x[block];
                y += layer.y[block];
                count += layer.count[block];
            }
            position += size;
        }
        Some((x, y, count))
    }

    fn sample_indexes(
        &mut self,
        start: u32,
        end: u32,
        strategy: u32,
        target: u32,
    ) -> Result<Vec<u32>, JsValue> {
        let (start, end) = clamp_range(self.len(), start, end);
        let count = end - start;
        let target = target_count(target, count);
        if strategy == LTTB {
            return source_indexes(&self.points_in_range(start, end), strategy, target);
        }
        if strategy == NONE || count <= target {
            return Ok((start..end).map(|index| index as u32).collect());
        }
        if target == 1 {
            return Ok(vec![start as u32]);
        }
        if target == 2 {
            return Ok(vec![start as u32, (end - 1) as u32]);
        }
        if strategy != PEAK && strategy != MIN && strategy != MAX && strategy != MINMAX {
            return Err(JsValue::from_str("strategy does not return source indexes"));
        }
        let bucket_count = if strategy == PEAK {
            (target - 2) / 4
        } else if strategy == MINMAX {
            (target - 2) / 2
        } else {
            target - 2
        };
        if bucket_count == 0 {
            return Ok(vec![start as u32, (end - 1) as u32]);
        }
        let mut indexes = vec![start];
        for bucket in 0..bucket_count {
            let (bucket_start, bucket_end) =
                bucket_bounds(bucket, bucket_count, start + 1, end - 1);
            let Some((minimum, maximum)) = self.query_extrema(bucket_start, bucket_end) else {
                return source_indexes(&self.points_in_range(start, end), strategy, target);
            };
            match strategy {
                MIN => push_unique(&mut indexes, minimum as usize),
                MAX => push_unique(&mut indexes, maximum as usize),
                MINMAX if minimum <= maximum => {
                    push_unique(&mut indexes, minimum as usize);
                    push_unique(&mut indexes, maximum as usize);
                }
                MINMAX => {
                    push_unique(&mut indexes, maximum as usize);
                    push_unique(&mut indexes, minimum as usize);
                }
                PEAK => {
                    let mut bucket_indexes = [
                        bucket_start,
                        minimum as usize,
                        maximum as usize,
                        bucket_end - 1,
                    ];
                    bucket_indexes.sort_unstable();
                    for index in bucket_indexes {
                        push_unique(&mut indexes, index);
                    }
                }
                _ => unreachable!(),
            }
        }
        push_unique(&mut indexes, end - 1);
        Ok(indexes.into_iter().map(|index| index as u32).collect())
    }

    fn sample_aggregates(
        &mut self,
        start: u32,
        end: u32,
        strategy: u32,
        target: u32,
    ) -> Result<Vec<f64>, JsValue> {
        if strategy != AVERAGE && strategy != SUM {
            return Err(JsValue::from_str(
                "strategy does not return aggregate values",
            ));
        }
        let (start, end) = clamp_range(self.len(), start, end);
        let target = target_count(target, end - start);
        let mut result = Vec::with_capacity(target * 2);
        for bucket in 0..target {
            let (bucket_start, bucket_end) = bucket_bounds(bucket, target, start, end);
            let Some((x, y, count)) = self.query_sum(bucket_start, bucket_end) else {
                return aggregate(&self.points_in_range(start, end), target, strategy);
            };
            result.push(x / count as f64);
            result.push(if strategy == AVERAGE {
                y / count as f64
            } else {
                y
            });
        }
        Ok(result)
    }
}

fn range_metrics(points: &[Point]) -> Vec<f64> {
    let Some(first) = points.first() else {
        return Vec::new();
    };
    let (mut minimum_x, mut maximum_x) = (first.x, first.x);
    let (mut minimum_y, mut maximum_y) = (first.y, first.y);
    for point in &points[1..] {
        minimum_x = minimum_x.min(point.x);
        maximum_x = maximum_x.max(point.x);
        minimum_y = minimum_y.min(point.y);
        maximum_y = maximum_y.max(point.y);
    }
    vec![minimum_x, maximum_x, minimum_y, maximum_y]
}

fn visible_range(points: &[Point], domain_start: f64, domain_end: f64) -> Vec<u32> {
    if !domain_start.is_finite() || !domain_end.is_finite() {
        return vec![0, 0];
    }
    let start_x = domain_start.min(domain_end);
    let end_x = domain_start.max(domain_end);
    let start = points.partition_point(|point| point.x < start_x);
    let end = points.partition_point(|point| point.x <= end_x);
    vec![start as u32, end as u32]
}

#[wasm_bindgen]
pub fn sample_indexes(
    x: &[f64],
    y: &[f64],
    strategy: u32,
    target: u32,
) -> Result<Vec<u32>, JsValue> {
    let points = validated_points(x, y)?;
    source_indexes(&points, strategy, target_count(target, points.len()))
}

#[wasm_bindgen]
pub fn sample_aggregates(
    x: &[f64],
    y: &[f64],
    strategy: u32,
    target: u32,
) -> Result<Vec<f64>, JsValue> {
    let points = validated_points(x, y)?;
    aggregate(&points, target_count(target, points.len()), strategy)
}

#[wasm_bindgen]
pub fn register_dataset(x: &[f64], y: &[f64], index_max_bytes: u32) -> Result<u32, JsValue> {
    let dataset = StoredDataset::new(x, y, index_max_bytes as usize)?;
    register_stored_dataset(dataset)
}

#[wasm_bindgen]
pub fn register_sample_dataset(
    y: &[f64],
    source_indexes: &[u32],
    start_time: f64,
    sample_rate: f64,
    index_max_bytes: u32,
) -> Result<u32, JsValue> {
    let dataset = StoredDataset::new_samples(
        y,
        source_indexes,
        start_time,
        sample_rate,
        index_max_bytes as usize,
    )?;
    register_stored_dataset(dataset)
}

fn register_stored_dataset(dataset: StoredDataset) -> Result<u32, JsValue> {
    DATASETS.with(|datasets| {
        let mut datasets = datasets.borrow_mut();
        if let Some((index, slot)) = datasets
            .iter_mut()
            .enumerate()
            .find(|(_, slot)| slot.is_none())
        {
            *slot = Some(dataset);
            return Ok(index as u32);
        }
        let handle = datasets.len() as u32;
        datasets.push(Some(dataset));
        Ok(handle)
    })
}

#[wasm_bindgen]
pub fn dispose_dataset(handle: u32) -> bool {
    DATASETS.with(|datasets| {
        let mut datasets = datasets.borrow_mut();
        let Some(slot) = datasets.get_mut(handle as usize) else {
            return false;
        };
        slot.take().is_some()
    })
}

#[wasm_bindgen]
pub fn dispose_all_datasets() {
    DATASETS.with(|datasets| datasets.borrow_mut().clear());
}

#[wasm_bindgen]
pub fn dataset_index_bytes(handle: u32) -> u32 {
    DATASETS.with(|datasets| {
        datasets
            .borrow()
            .get(handle as usize)
            .and_then(Option::as_ref)
            .map_or(0, |dataset| {
                dataset.index_bytes.min(u32::MAX as usize) as u32
            })
    })
}

#[wasm_bindgen]
pub fn sample_dataset_indexes(
    handle: u32,
    start: u32,
    end: u32,
    strategy: u32,
    target: u32,
) -> Result<Vec<u32>, JsValue> {
    DATASETS.with(|datasets| {
        let mut datasets = datasets.borrow_mut();
        let dataset = datasets
            .get_mut(handle as usize)
            .and_then(Option::as_mut)
            .ok_or_else(|| JsValue::from_str("dataset handle was not found"))?;
        dataset.sample_indexes(start, end, strategy, target)
    })
}

#[wasm_bindgen]
pub fn sample_dataset_aggregates(
    handle: u32,
    start: u32,
    end: u32,
    strategy: u32,
    target: u32,
) -> Result<Vec<f64>, JsValue> {
    DATASETS.with(|datasets| {
        let mut datasets = datasets.borrow_mut();
        let dataset = datasets
            .get_mut(handle as usize)
            .and_then(Option::as_mut)
            .ok_or_else(|| JsValue::from_str("dataset handle was not found"))?;
        dataset.sample_aggregates(start, end, strategy, target)
    })
}

/** Returns [minimum X, maximum X, minimum Y, maximum Y], or an empty array for no valid points. */
#[wasm_bindgen]
pub fn calculate_range(x: &[f64], y: &[f64]) -> Result<Vec<f64>, JsValue> {
    let points = validated_points(x, y)?;
    Ok(range_metrics(&points))
}

/** Returns the half-open [start, end) range in the normalized ascending-X point sequence. */
#[wasm_bindgen]
pub fn find_visible_range(
    x: &[f64],
    y: &[f64],
    domain_start: f64,
    domain_end: f64,
) -> Result<Vec<u32>, JsValue> {
    let points = validated_points(x, y)?;
    Ok(visible_range(&points, domain_start, domain_end))
}
