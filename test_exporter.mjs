import makerjs from 'makerjs';

const model = {
    paths: {
        'l1': new makerjs.paths.Line([0,0], [10,0]),
        'a1': new makerjs.paths.Arc([10, 5], 5, 270, 90)
    }
};

const svg = makerjs.exporter.toSVG(model);
console.log('SVG:', svg.substring(0, 100) + '...');

const dxf = makerjs.exporter.toDXF(model);
console.log('DXF:', dxf.substring(0, 100) + '...');
