import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

/** MathJax sizes its SVG output in ex units with 1ex = 0.5em (its `exFactor` default). */
export const EX_PER_EM = 0.5;

export interface MathSvg {
  svg: string;
  /** Rendered width in ex units. */
  widthEx: number;
  /** Total rendered height in ex units, ascent plus depth. */
  heightEx: number;
  /** Depth below the text baseline in ex units. */
  depthEx: number;
}

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const mathDocument = mathjax.document("", {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: "none" }),
});

export function mathSvg(latex: string, color: string, display = true): MathSvg {
  const markup = adaptor.outerHTML(mathDocument.convert(latex, { display }));
  const svgStart = markup.indexOf("<svg");
  const svgEnd = markup.lastIndexOf("</svg>");
  if (svgStart < 0 || svgEnd < 0) throw new Error("MathJax did not return SVG output.");
  const svg = markup.slice(svgStart, svgEnd + 6).replaceAll("currentColor", color);
  return {
    svg,
    widthEx: exValue(svg, /\swidth="(-?[\d.]+)ex"/),
    heightEx: exValue(svg, /\sheight="(-?[\d.]+)ex"/),
    depthEx: Math.max(0, -exValue(svg, /vertical-align:\s*(-?[\d.]+)ex/)),
  };
}

function exValue(svg: string, pattern: RegExp): number {
  const match = svg.match(pattern);
  return match ? Number.parseFloat(match[1]) : 0;
}
