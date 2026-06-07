export interface GraphNode {
	id: string;
	label: string;
	level: 0 | 1 | 2;
	summary: string;
}

export interface GraphEdge {
	from: string;
	to: string;
}

export interface GraphData {
	nodes: GraphNode[];
	edges: GraphEdge[];
}
