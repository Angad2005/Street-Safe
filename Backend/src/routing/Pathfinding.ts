//------------------------------- Types ---------------------------------------

import { getAllHazards, Hazard } from "../Hazards";

type Point = { x: number; y: number } | { lat: number; lng: number };

export type Edge =
{
  nodeA: number,
  nodeB: number,
  ptA: { lat: number; lng: number },
  ptB: { lat: number; lng: number },
  refs: number[],
  wayId: number,
  wayTags: Record<string, string>,
}

type SnapResult = {
  snapped: Point;
  edge: Edge;
  t: number;
  distance: number;
};

// ----------------------------- Path result (export types) -----------------------------------

export type PathStep = {
  /** Graph node ID (-1 = virtual start, -2 = virtual end) */
  nodeId: number;
  /** Coordinates of this node */
  point: any;
  /** Edge taken to arrive here (undefined for the first step) */
  via?: Edge;
};

export type PathResult = {
  found: true;
  steps: PathStep[];
  /** Total traversal cost (same units as your distance function) */
  totalCost: number;
} | {
  found: false;
};

// -------------------------------Internal graph types -------------------------------

type GraphNeighbour = {
  toNode: number;
  toPoint: any;
  cost: number;
  /** The original Edge this link comes from, or null for virtual links */
  edge: Edge | null;
};

type NodeRecord = {
  /** g – cost from start */
  g: number;
  /** f = g + h */
  f: number;
  parent: number | null;
  parentEdge: Edge | null;
};


function hazardDanger(x: number, category: string): number {
  const dangerRadius = 10;
  const safetyRadius = 100;
  const dangerMultiplier = 2;

  // A hazard within 10m is 2x as dangerous as no hazards
  if (x <= dangerRadius) return dangerMultiplier;

  // Ignore hazards further than 100m
  if (x >= safetyRadius) return 0;

  const danger = dangerMultiplier * (1 - (x - dangerRadius) / (safetyRadius - dangerRadius));

  // Police will invert the danger
  return category === "police" ? 1/danger : danger;
}

function scaleDistance(hazards: Hazard[], edge: Edge, distance: number): number {

  const highwayWeights: Record<string, number> = {
    motorway: 1.6,
    trunk: 1.4,
    primary: 1.1,
    secondary: 0.9,
    tertiary: 0.8,
    unclassified: 0.85,
    residential: 0.6,
    service: 1.2,
  };

  const highwayScale = highwayWeights[edge.wayTags.highway] ?? 1.0;

  const avg = { lat: edge.ptA.lat + (edge.ptB.lat - edge.ptA.lat) / 2, lng: edge.ptA.lng + (edge.ptB.lng - edge.ptA.lng) / 2 };
  
  const hazardDistances = hazards.map(hazard => {
    return { distance: ptDist({ lat: hazard.Latitude, lng: hazard.Longitude }, avg), category: hazard.Category };
  });

  // Assume hazards 100m away are far enough to be safe
  const filteredDistances = hazardDistances.filter(d => d.distance <= 100);

  const multipliers = filteredDistances.map(d => {
    return hazardDanger(d.distance, d.category);
  });

  // Multiply all hazards together
  const totalHazardMultiplier = multipliers.reduce((a, b) => a * b, 1);

  return distance * totalHazardMultiplier * highwayScale;
}

// ------------------------ Geometry helpers ----------------------------------

function isLatLng(pt: any): pt is { lat: number; lng: number } {
  return pt != null && "lat" in pt && "lng" in pt;
}

//Euclidean distance that works for both {x,y} and {lat,lng} points.

export function ptDist(a: any, b: any): number {
  if (isLatLng(a) && isLatLng(b)) {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const aa =
      sinDLat * sinDLat +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        sinDLng *
        sinDLng;
    return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  }
  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dy = (a.y ?? 0) - (b.y ?? 0);
  return Math.sqrt(dx * dx + dy * dy);
}

// --------------------------- Minimal priority queue ---------------------------------

class MinHeap
{
  private data: Array<{ id: number; f: number }> = [];

  push(id: number, f: number)
  {
    this.data.push({ id, f });
    this.heapifyUp(this.data.length - 1);
  }

  pop(): { id: number; f: number } | undefined
  {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;

    if (this.data.length > 0)
    {
      this.data[0] = last;
      this.heapifyDown(0);
    }

    return top;
  }

  get size()
  {
    return this.data.length;
  }

  private heapifyUp(index: number) {
    while (index > 0)
    {
      const parent = (index - 1) >> 1;
      if (this.data[parent].f <= this.data[index].f) break;
      [this.data[parent], this.data[index]] = [this.data[index], this.data[parent]];
      index = parent;
    }
  }

  private heapifyDown(index: number) {
    const n = this.data.length;
    while (true)
    {
      let smallest = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      if (leftChild < n && this.data[leftChild].f < this.data[smallest].f) smallest = leftChild;
      if (rightChild < n && this.data[rightChild].f < this.data[smallest].f) smallest = rightChild;
      if (smallest === index) break;
      [this.data[smallest], this.data[index]] = [this.data[index], this.data[smallest]];
      index = smallest;
    }
  }
}

// ---------------------------------Graph builder -------------------------------

const PHANTOM_START = -1;
const PHANTOM_END = -2;

/**
 * Builds an adjacency list from the edge array.
 * Returns both the graph and a position map so the heuristic can look up any node.
 */
function buildGraph(edges: Edge[]): {
  adjacencyList: Map<number, GraphNeighbour[]>;
  nodePos: Map<number, any>;
} {
  const adjacencyList = new Map<number, GraphNeighbour[]>();
  const nodePos = new Map<number, any>();

  const addNeighbour = (from: number, n: GraphNeighbour) => {
    if (!adjacencyList.has(from)) adjacencyList.set(from, []);
    adjacencyList.get(from)!.push(n);
  };

  const hazards = getAllHazards();
  for (const edge of edges) {
    const { nodeA, nodeB, ptA, ptB } = edge;
    nodePos.set(nodeA, ptA);
    nodePos.set(nodeB, ptB);

    const cost = scaleDistance(hazards, edge, ptDist(ptA, ptB));

    addNeighbour(nodeA, { toNode: nodeB, toPoint: ptB, cost, edge });
    addNeighbour(nodeB, { toNode: nodeA, toPoint: ptA, cost, edge });
  }

  return { adjacencyList, nodePos };
}

// ─── A* core ──────────────────────────────────────────────────────────────────

/**
 * The snap points are treated as virtual nodes (PHANTOM_START / PHANTOM_END)
 * that are connected to the two endpoints of their respective edges. If both
 * snaps fall on the same edge a direct shortcut is also added.
 *
 * @param edges   All traversable edges in the network.
 * @param from    Snapped start position.
 * @param to      Snapped destination position.
 */

export function astar(
  edges: Edge[],
  from: SnapResult,
  to: SnapResult
): PathResult
{
  const { adjacencyList, nodePos } = buildGraph(edges);

  // ---------------------- set start and end points as nodes ---------------------------

  nodePos.set(PHANTOM_START, from.snapped);
  nodePos.set(PHANTOM_END, to.snapped);

  if (!adjacencyList.has(PHANTOM_START)) adjacencyList.set(PHANTOM_START, []);
  if (!adjacencyList.has(PHANTOM_END)) adjacencyList.set(PHANTOM_END, []);

  // Start node → both endpoints of start edge

  const startEdge = from.edge;
  adjacencyList.get(PHANTOM_START)!.push(
    {
      toNode: startEdge.nodeA,
      toPoint: startEdge.ptA,
      cost: ptDist(from.snapped, startEdge.ptA),
      edge: startEdge,
    },
    {
      toNode: startEdge.nodeB,
      toPoint: startEdge.ptB,
      cost: ptDist(from.snapped, startEdge.ptB),
      edge: startEdge,
    }
  );

  // Both endpoints of end edge → end virtual node

  const endEdge = to.edge;
  const endNeighbours = adjacencyList.get(endEdge.nodeA) ?? [];
  endNeighbours.push({
    toNode: PHANTOM_END,
    toPoint: to.snapped,
    cost: ptDist(endEdge.ptA, to.snapped),
    edge: endEdge,
  });
  adjacencyList.set(endEdge.nodeA, endNeighbours);

  const endNeighboursB = adjacencyList.get(endEdge.nodeB) ?? [];
  endNeighboursB.push({
    toNode: PHANTOM_END,
    toPoint: to.snapped,
    cost: ptDist(endEdge.ptB, to.snapped),
    edge: endEdge,
  });
  adjacencyList.set(endEdge.nodeB, endNeighboursB);

  // Direct shortcut when both snaps are on the same edge

  const sameEdge =
    startEdge.nodeA === endEdge.nodeA && startEdge.nodeB === endEdge.nodeB &&
    startEdge.wayId === endEdge.wayId;

  if (sameEdge) {
    adjacencyList.get(PHANTOM_START)!.push({
      toNode: PHANTOM_END,
      toPoint: to.snapped,
      cost: ptDist(from.snapped, to.snapped),
      edge: startEdge,
    });
  }

  // --------------------------------- -A* search ------------------------------------


  const open = new MinHeap();
  const records = new Map<number, NodeRecord>();

  const heuristic = (nodeId: number): number => {
    const pos = nodePos.get(nodeId);
    if (!pos) return 0;
    return ptDist(pos, to.snapped);
  };

  const startRecord: NodeRecord = {
    g: 0,
    f: heuristic(PHANTOM_START),
    parent: null,
    parentEdge: null,
  };

  records.set(PHANTOM_START, startRecord);
  open.push(PHANTOM_START, startRecord.f);

  const closed = new Set<number>();

  while (open.size > 0) {
    const { id: current } = open.pop()!;

    if (closed.has(current)) continue;
    closed.add(current);

    if (current === PHANTOM_END) {
      return reconstructPath(current, records, nodePos);
    }

    const neighbours = adjacencyList.get(current) ?? [];

    for (const neighbour of neighbours) {
      if (closed.has(neighbour.toNode)) continue;

      const currentRecord = records.get(current)!;
      const tentativeG = currentRecord.g + neighbour.cost;

      const existing = records.get(neighbour.toNode);
      if (existing && tentativeG >= existing.g) continue;

      const g = tentativeG;
      const f = g + heuristic(neighbour.toNode);

      records.set(neighbour.toNode, {
        g,
        f,
        parent: current,
        parentEdge: neighbour.edge,
      });

      open.push(neighbour.toNode, f);
    }
  }

  return { found: false };
}

// --------------------------Path reconstruction ------------------------------
// Traces the path backwards from the destination to the start
// so the final list runs start → end. 
function reconstructPath(
  endNode: number,
  records: Map<number, NodeRecord>,
  nodePos: Map<number, any>
): PathResult
{
  const steps: PathStep[] = [];
  let current: number | null = endNode;

  while (current !== null)
  {
    const record : NodeRecord = records.get(current)!;
    steps.unshift({
      nodeId: current,
      point: nodePos.get(current),
      via: record.parentEdge ?? undefined,
    });
    current = record.parent;
  }

  // Remove the 'via' from the very first step (it has no parent)
  if (steps.length > 0) delete steps[0].via;

  const totalCost = records.get(endNode)!.g;

  return { found: true, steps, totalCost };
}