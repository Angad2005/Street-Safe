import * as fs from "fs";
import { Edge } from "./Pathfinding";

// set of tags that decrlare the way is walkable
const WALKABLE_HIGHWAY = new Set
([
  "footway", "path", "pedestrian", "steps",
  "living_street", "residential", "unclassified",
  "track", "service", "cycleway",
  "tertiary",
  "secondary",
  "primary",
]);
 
//tags that declare the highway as NOT walkable
const BLOCKED_HIGHWAY = new Set
([
  "motorway", "motorway_link", "trunk", "trunk_link",
]);

interface OSMtags
{
  highway?:  string;
  foot?:     string;
  access?:   string;
  surface?:  string;
  name?:     string;
  oneway?:   string;
  [key: string]: string | undefined;
}

export interface bboxInterface
{
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface bboxQuery
{
  bbox?: bboxInterface;
}

interface Way {
  id: number;
  tags: Record<string, string>;
  refs: number[];
}

function walkabilityTagFilter(tags: OSMtags = {}) : boolean {
  if (!tags.highway && tags.foot !== "yes")           return false;
  if (tags.foot === "no")                             return false;
  if (tags.access === "no"      && tags.foot !== "yes") return false;
  if (tags.access === "private" && tags.foot !== "yes") return false;
  if (tags.highway)
  {
    if (!WALKABLE_HIGHWAY.has(tags.highway) && tags.foot !== "yes") return false;
    if (BLOCKED_HIGHWAY.has(tags.highway))              return false;
  }

  return true;
}

export async function filterWalkable(filePath: string, query: bboxQuery = {}): Promise<{ nodeMap: Map<number, { lat: number, lng: number }>, ways: Way[], edges: Edge[] }>
{
  const bbox = query.bbox;
  const pbfParser = require("osm-pbf-parser");

  const nodeMap = new Map<number, { lat: number, lng: number }>();
  const ways: Way[] = [];
  const requiredNodes = new Set<number>();

  // Pass 1: Identify walkable ways and the nodes they reference
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(pbfParser())
      .on('data', (items: any) => {
        for (const item of items)
        {
          if (item.type === "way")
          {
            const tags = item.tags ?? {};
            const isWalkable: boolean = walkabilityTagFilter(tags);
            if (!isWalkable) continue;

            ways.push({ id: item.id, tags, refs: item.refs });
            for (const ref of item.refs)
            {
              requiredNodes.add(ref);
            }
          }
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  // Pass 2: Collect coordinates for only the required nodes
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(pbfParser())
      .on('data', (items: any) => {
        for (const item of items)
        {
          if (item.type === "node" && requiredNodes.has(item.id))
          {
            nodeMap.set(item.id, { lat: item.lat, lng: item.lon});
          }
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  // Final filtering: Only keep ways that are within the bounding box (if provided)
  // and have all their nodes loaded.
  const filteredWays: Way[] = [];
  for (const way of ways)
  {
    const allNodesFound = way.refs.every(ref => nodeMap.has(ref));
    if (!allNodesFound) continue;

    if (bbox)
    {
      const isWithinBbox = way.refs.some(ref => {
        const node = nodeMap.get(ref)!;
        return node.lat >= bbox.minLat && node.lat <= bbox.maxLat &&
               node.lng >= bbox.minLng && node.lng <= bbox.maxLng;
      });
      if (!isWithinBbox) continue;
    }
    filteredWays.push(way);
  }

  const edges = buildEdges(nodeMap, filteredWays);

  return { nodeMap, ways: filteredWays, edges };
}


//builds the edges to return for pathfinding

function buildEdges(nodeMap: Map<number, any>, ways: Way[]): Edge[]
{
  const edges: Edge[] = [];

  for (const way of ways)
  {
    for (let i = 0; i < way.refs.length - 1; i++)
    {
      const idA = way.refs[i];
      const idB = way.refs[i + 1];
      const ptA = nodeMap.get(idA);
      const ptB = nodeMap.get(idB);

      if (!ptA || !ptB) continue;

      edges.push
      ({
        nodeA:   idA,
        nodeB:   idB,
        ptA,
        ptB,
        refs:  way.refs,
        wayId:   way.id,
        wayTags: way.tags,
      })
    }
  }

  const adj = new Map<number, number[]>();
  for (const e of edges) {
    if (!adj.has(e.nodeA)) adj.set(e.nodeA, []);
    if (!adj.has(e.nodeB)) adj.set(e.nodeB, []);
    adj.get(e.nodeA)!.push(e.nodeB);
    adj.get(e.nodeB)!.push(e.nodeA);
  }

  const visited = new Set<number>();
  let maxComp = new Set<number>();

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      const comp = new Set<number>();
      const q = [node];
      visited.add(node);

      // BFS
      let head = 0;
      while (head < q.length) {
        const curr = q[head++];
        comp.add(curr);
        const neighbors = adj.get(curr);
        if (neighbors) {
          for (const nxt of neighbors) {
            if (!visited.has(nxt)) {
              visited.add(nxt);
              q.push(nxt);
            }
          }
        }
      }
      if (comp.size > maxComp.size) {
        maxComp = comp;
      }
    }
  }

  return edges.filter(e => maxComp.has(e.nodeA) && maxComp.has(e.nodeB));
}
