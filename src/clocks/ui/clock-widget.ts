import { Clock } from "clocks/clock";
import { html, svg } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { range } from "lit-html/directives/range.js";

export function clockWidget(
  clock: Clock,
  onClickSegment?: (newProgress: number, segment: number) => void,
) {
  const renderPath = (i: number) => {
    return svg`<path
      d="${pathString(i, clock.segments)}"
      class="clock-segment svg"
      aria-selected="${clock.progress === i + 1}"
      @click=${onClickSegment && (() => onClickSegment(i === 0 && clock.progress === 1 ? 0 : i + 1, i))}
    ></path>`;
  };

  //() => this.updateClockProgress({ progress: i === 0 && clock.progress === 1 ? 0 : i + 1 })
  return html`<svg
    class="iron-vault-clock-widget"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="-55 -55 110 110"
    aria-valuenow=${clock.progress}
    aria-valuetext="${clock.progress}⁄${clock.segments}"
  >
    ${map(range(clock.segments), renderPath)}
  </svg>`;
}

const R = 50;

function pathString(wedgeIdx: number, numWedges: number) {
  const wedgeAngle = (2 * Math.PI) / numWedges;
  const startAngle = wedgeIdx * wedgeAngle - Math.PI / 2;
  const x1 = R * Math.cos(startAngle);
  const y1 = R * Math.sin(startAngle);
  const x2 = R * Math.cos(startAngle + wedgeAngle);
  const y2 = R * Math.sin(startAngle + wedgeAngle);

  return `M0,0 L${x1},${y1} A${R},${R} 0 0,1 ${x2},${y2} z`;
}
