import Link from "next/link";

type Item = { label: string; count: number; href?: string };

/**
 * Single-series horizontal bars as a real table, so the numbers are readable
 * without colour and by screen readers. One hue (validated against the card
 * surface), values in text colour at the bar tip, native tooltip on hover.
 */
export function BarList({ caption, items, unit = "ads" }: { caption: string; items: Item[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <table className="w-full border-separate border-spacing-y-1.5 text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Category</th>
          <th scope="col">Number of {unit}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const pct = (item.count / max) * 100;
          return (
            <tr key={item.label} title={`${item.label}: ${item.count} ${unit}`}>
              <th scope="row" className="w-28 pr-3 text-left font-normal text-muted-foreground">
                {item.href ? (
                  <Link href={item.href} className="hover:text-foreground hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  item.label
                )}
              </th>
              <td className="w-full">
                <div className="flex items-center gap-2">
                  {item.count > 0 ? (
                    <div
                      className="h-4 rounded-r-[4px] bg-data-bar"
                      style={{ width: `max(2px, calc(${pct}% - 3rem))` }}
                      aria-hidden
                    />
                  ) : null}
                  <span className="tabular-nums">{item.count}</span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
