import type { ChartDefinition } from "./types";

import SankeyChart,         { sankeyDefinition }          from "./plotly/SankeyChart";
import ParallelCoordsChart, { parallelCoordsDefinition }  from "./plotly/ParallelCoordsChart";
import BubbleScatter,       { bubbleScatterDefinition }   from "./plotly/BubbleScatter";
import NetworkChart,        { networkDefinition }         from "./d3/NetworkChart";
import BubbleNetwork,       { bubbleNetworkDefinition }   from "./d3/BubbleNetwork";
import ChordChart,          { chordDefinition }           from "./d3/ChordChart";
import BulletChart,         { bulletDefinition }          from "./d3/BulletChart";
import TimelineChart,       { timelineDefinition }        from "./d3/TimelineChart";
import EventTimeline,       { eventTimelineDefinition }   from "./d3/EventTimeline";
import Ridgeplot,           { ridgeplotDefinition }       from "./d3/Ridgeplot";

const definitions: Record<string, ChartDefinition> = {
  [sankeyDefinition.id]:           { ...sankeyDefinition,           renderComponent: SankeyChart },
  [parallelCoordsDefinition.id]:   { ...parallelCoordsDefinition,   renderComponent: ParallelCoordsChart },
  [bubbleScatterDefinition.id]:    { ...bubbleScatterDefinition,    renderComponent: BubbleScatter },
  [networkDefinition.id]:          { ...networkDefinition,          renderComponent: NetworkChart },
  [bubbleNetworkDefinition.id]:    { ...bubbleNetworkDefinition,    renderComponent: BubbleNetwork },
  [chordDefinition.id]:            { ...chordDefinition,            renderComponent: ChordChart },
  [bulletDefinition.id]:           { ...bulletDefinition,           renderComponent: BulletChart },
  [timelineDefinition.id]:         { ...timelineDefinition,         renderComponent: TimelineChart },
  [eventTimelineDefinition.id]:    { ...eventTimelineDefinition,    renderComponent: EventTimeline },
  [ridgeplotDefinition.id]:        { ...ridgeplotDefinition,        renderComponent: Ridgeplot },
};

export function getChart(id: string): ChartDefinition | undefined {
  return definitions[id];
}

export function listCharts(): ChartDefinition[] {
  return Object.values(definitions);
}
