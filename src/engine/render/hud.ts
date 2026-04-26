import paper from 'paper';


/**
 * HUD Manager
 * Displays real-time dimensions and handles numeric input capturing.
 */
export class HUDManager {
    private inputString: string = "";
    private isActive: boolean = false;

    constructor(
        private layer: paper.Layer
    ) {}

    public activateInput() {
        this.isActive = true;
        this.inputString = "";
    }

    public deactivateInput() {
        this.isActive = false;
        this.inputString = "";
    }

    public handleKey(key: string): boolean {
        if (!this.isActive) return false;

        if (key === 'Enter') {
            return true; // Signal completion
        }
        if (key === 'Backspace') {
            this.inputString = this.inputString.slice(0, -1);
            return false;
        }
        if (/^[0-9.]$/.test(key)) {
            this.inputString += key;
            return false;
        }
        return false;
    }

    public getInputValue(): number | null {
        const val = parseFloat(this.inputString);
        return isNaN(val) ? null : val;
    }

    public draw(mouseScreen: paper.Point, dimensions: {l?: number, w?: number, h?: number, angle?: number}): void {
        this.layer.activate();
        this.layer.removeChildren();

        const padding = 5;
        const boxWidth = 80;
        const boxHeight = 20;

        // Position HUD near mouse
        const pos = mouseScreen.add(new paper.Point(15, 15));

        // Background
        const bg = new paper.Path.Rectangle(
            new paper.Rectangle(pos, new paper.Size(boxWidth, boxHeight * 2))
        );
        bg.fillColor = new paper.Color(0, 0, 0, 0.6);
        bg.strokeColor = new paper.Color('#00aaff');
        bg.strokeWidth = 1;

        // Text display
        const text = new paper.PointText(pos.add(new paper.Point(padding, 14)));
        text.fillColor = new paper.Color('#ffffff');
        text.fontSize = 11;
        text.fontFamily = 'monospace';

        let lines = [];
        if (dimensions.l !== undefined) {
            lines.push(`L: ${dimensions.l.toFixed(3)}`);
        }
        if (dimensions.w !== undefined && dimensions.h !== undefined) {
            lines.push(`W: ${dimensions.w.toFixed(3)}`);
            lines.push(`H: ${dimensions.h.toFixed(3)}`);
        }
        if (this.isActive) {
            lines.push(`IN: ${this.inputString}_`);
        }

        text.content = lines.join('\n');
        
        // Adjust bg height based on lines
        bg.bounds.height = lines.length * 15 + padding * 2;

        (paper.view as any).draw();
    }

    public clear(): void {
        this.layer.removeChildren();
    }
}
