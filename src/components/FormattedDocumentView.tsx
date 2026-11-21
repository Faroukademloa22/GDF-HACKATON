import React from 'react';

interface FormattedDocumentViewProps {
  markdown: string;
}

/**
 * Renders structured legal & financial Markdown documents cleanly without raw # or ** syntax,
 * converting headings, pipe tables, lists, and paragraphs into crisp print-ready layout.
 */
export const FormattedDocumentView: React.FC<FormattedDocumentViewProps> = ({ markdown }) => {
  const lines = markdown.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-[#ECFDF5]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line)) {
      blocks.push(<hr key={`hr_${i}`} className="border-[#1F2B24] my-4" />);
      i += 1;
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      blocks.push(
        <h2
          key={`h1_${i}`}
          className="text-lg font-semibold text-[#ECFDF5] tracking-tight pt-1 pb-2 border-b border-[#1F2B24]"
        >
          {renderInline(line.slice(2))}
        </h2>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h3 key={`h2_${i}`} className="text-sm font-semibold text-[#22C55E] pt-3">
          {renderInline(line.slice(3))}
        </h3>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(
        <h4 key={`h3_${i}`} className="text-xs font-semibold text-[#ECFDF5] pt-2">
          {renderInline(line.slice(4))}
        </h4>
      );
      i += 1;
      continue;
    }

    // Markdown table
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i += 1;
      }

      const parseRow = (row: string) =>
        row
          .slice(1, -1)
          .split('|')
          .map((cell) => cell.trim());

      const headers = parseRow(tableLines[0]);
      const bodyRows = tableLines
        .slice(1)
        .filter((r) => r.replace(/[|\s:-]/g, '').length > 0)
        .map(parseRow);

      blocks.push(
        <div key={`tbl_${i}`} className="overflow-x-auto border border-[#1F2B24] rounded-md my-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#121915] border-b border-[#1F2B24] text-[#86968C]">
                {headers.map((h, idx) => (
                  <th key={idx} className="py-2 px-3 font-medium">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2B24]">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="bg-[#090C0A]">
                  {row.map((cell, cIdx) => {
                    const isMoney = /₦|\d+%/.test(cell);
                    return (
                      <td
                        key={cIdx}
                        className={`py-2 px-3 text-[#D1FAE5] ${
                          isMoney ? 'font-mono tabular-nums whitespace-nowrap' : ''
                        }`}
                      >
                        {renderInline(cell)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <ul key={`ul_${i}`} className="space-y-1.5 pl-4 list-disc text-xs text-[#C7D8CE] leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol_${i}`} className="space-y-1.5 pl-4 list-decimal text-xs text-[#C7D8CE] leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Standard paragraph
    blocks.push(
      <p key={`p_${i}`} className="text-xs text-[#C7D8CE] leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i += 1;
  }

  return <div className="space-y-3">{blocks}</div>;
};
