import makerjs from 'makerjs';

const line1 = new makerjs.paths.Line([0,0], [10,0]);
const line2 = new makerjs.paths.Line([10,0], [10,10]);
const f = makerjs.path.fillet(line1, line2, 2);
console.log('Arc', f);
// Can we ask for arc endpoints?
console.log('Arc points?', makerjs.point.fromArc(f));
