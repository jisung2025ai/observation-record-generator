import fs from 'fs';
import path from 'path';
const csvPath = 'd:\\myapp\\rpa2\\scripts\\csv_generator\\output\\관찰척도_20260304_152810.csv';
const content = fs.readFileSync(csvPath, 'utf-8');

function parseCsvLine(text) {
    let ret = [];
    let inQuote = false;
    let val = '';
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        if (char === '\"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            ret.push(val);
            val = '';
        } else {
            val += char;
        }
    }
    ret.push(val);
    return ret;
}

const lines = content.split('\n').filter(l => l.trim() !== '');
const data = {};

for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 7) continue;

    const domain = row[0].trim();
    const itemNum = row[1].replace(/\D/g, '');
    let itemText = row[2].trim();
    itemText = itemText.replace(/(?<=[가-힣a-zA-Z])\d+(?=[.!?,;:]*($))/g, '');

    let level1 = row[3].trim().replace(/(?<=[가-힣a-zA-Z])\d+(?=[.!?,;:]*($))/g, '');
    let level2 = row[4].trim().replace(/(?<=[가-힣a-zA-Z])\d+(?=[.!?,;:]*($))/g, '');
    let level3 = row[5].trim().replace(/(?<=[가-힣a-zA-Z])\d+(?=[.!?,;:]*($))/g, '');
    let level4 = row[6].trim().replace(/(?<=[가-힣a-zA-Z])\d+(?=[.!?,;:]*($))/g, '');

    if (!data[domain]) data[domain] = {};

    data[domain][itemNum] = { text: itemText, levels: { '1': level1, '2': level2, '3': level3, '4': level4 } };
}

const fileContent = 'export interface ObservationItem {\n  text: string;\n  levels: {\n    "1": string;\n    "2": string;\n    "3": string;\n    "4": string;\n  };\n}\n\nexport const OBSERVATION_ITEMS: Record<string, Record<string, ObservationItem>> = ' + JSON.stringify(data, null, 2) + ';\n';
fs.writeFileSync('src/app/data/items.ts', fileContent, 'utf-8');
console.log('SUCCESS');
