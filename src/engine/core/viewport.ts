export interface ViewTransform {
    scale: number;     // px per μm
    offsetX: number;   // px
    offsetY: number;   // px
}

// ------------------------------------
// 明示的座標変換ロジック (Geometry <-> View)
// ------------------------------------

/**
 * World(BigInt μm) -> Screen(Pixel Number)
 * 描画層へ送るピクセル絶対空間を決定する。
 * 
 * 基準:
 * - 画面の原点は左上(0, 0)。Yは下方向に増加する。
 * - CAD上のY座標を「画面座標では上方向（Y値小）に展開する」仕様とする。
 */
export function worldToScreen(x: bigint, y: bigint, view: ViewTransform): { sx: number, sy: number } {
    const sx = view.offsetX + Number(x) * view.scale;
    const sy = view.offsetY - Number(y) * view.scale; 
    return { sx, sy };
}

/**
 * Screen(Pixel Number) -> World(BigInt μm)
 * ユーザーのマウス入力等から、論理空間のμm座標を導き出す。
 */
export function screenToWorld(sx: number, sy: number, view: ViewTransform): { x: bigint, y: bigint } {
    const nx = Math.round((sx - view.offsetX) / view.scale);
    const ny = Math.round((view.offsetY - sy) / view.scale);
    return { x: BigInt(nx), y: BigInt(ny) };
}

/**
 * Zoomに応じた描画用LODグリッド間隔(μm単位)を動的に算出する関数
 */
export function getGridIntervalUmForLOD(scale: number): bigint {
    // 画面上で少なくとも 'minSpacingPx' の間隔を確保して描画するためのしきい値
    const minSpacingPx = 50; 
    const targetUm = minSpacingPx / scale;

    if (targetUm <= 10) return 10n;     // 最大拡大時は10μm
    if (targetUm <= 50) return 50n;
    if (targetUm <= 100) return 100n;
    if (targetUm <= 500) return 500n;
    if (targetUm <= 1000) return 1000n;   // 1mm
    if (targetUm <= 5000) return 5000n;   // 5mm
    return 10000n;                        // 10mm（最小縮小時）
}
