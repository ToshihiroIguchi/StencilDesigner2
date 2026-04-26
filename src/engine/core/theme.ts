/**
 * 純粋なView Layer用のテーマシステム。
 * 色定義のみを持つ純粋なデータ層。
 */
export type Theme = {
    background: string;
    gridMajor: string;
    gridMinor: string;
    axis: string;
    edge: string;
    vertex: string;
    highlight: string;
};

export const DarkTheme: Theme = {
    background: '#1e1e1e',
    gridMajor: '#3a3a3a',
    gridMinor: '#2a2a2a',
    axis: '#ff5555',
    edge: '#ffffff',
    vertex: '#00aaff',
    highlight: '#00aaff'
};

export const LightTheme: Theme = {
    background: '#fcfcfc',
    gridMajor: '#dcdcdc',
    gridMinor: '#f0f0f0',
    axis: '#ff0000',
    edge: '#121212',
    vertex: '#0055ff',
    highlight: '#0055ff'
};

export let currentTheme: Theme = DarkTheme;

export function getTheme(): Theme {
    return currentTheme;
}

export function setTheme(theme: Theme) {
    currentTheme = theme;
}

export function toggleTheme(): void {
    if (currentTheme === DarkTheme) {
        setTheme(LightTheme);
    } else {
        setTheme(DarkTheme);
    }
}
