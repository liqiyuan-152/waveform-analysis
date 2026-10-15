import { ColorInputView } from '../../src/controls/ColorInputView'
import '../../src/styles/native.css'
const view = new ColorInputView(document, '颜色', '#1677ff', () => {})
document.querySelector('#picker')!.append(view.root)
