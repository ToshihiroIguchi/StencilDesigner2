import makerjs from 'makerjs';

const line1 = new makerjs.paths.Line([0,0], [10,0]);
const line2 = new makerjs.paths.Line([10,0], [10,10]);
const model = { paths: { l1: line1, l2: line2 } };
console.log('Testing makerjs...');
try {
    const f = makerjs.path.fillet(line1, line2, 2);
    console.log('Path Fillet success:', f);
} catch(e) {
    console.log('Error', e);
}
