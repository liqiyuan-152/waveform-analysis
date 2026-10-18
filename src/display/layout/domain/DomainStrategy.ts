export type Domain = [number, number]

export interface DomainStrategy {
  resolve(domain: Domain): Domain
}
