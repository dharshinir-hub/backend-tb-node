import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position, useNodesState, useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Typography, Button, Chip, CircularProgress, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { getAssemblyTree } from '../../../Services/app/zumenservice';

const STATUS_COLORS = {
  'New Model': '#3b82f6', 'In Production': '#10b981', Approved: '#10b981',
  Cancelled: '#ef4444', Hold: '#f59e0b',
};
const statusColor = (s) => STATUS_COLORS[s] || '#6b7280';

const X_GAP = 250;
const Y_GAP = 96;

// Flatten the nested assembly tree into React Flow nodes + edges with a tidy
// left-to-right layered layout (x = depth, y = balanced over children).
const toFlow = (root) => {
  const nodes = [];
  const edges = [];
  let leaf = 0;
  const place = (node, depth) => {
    const childYs = node.children.map((c) => {
      edges.push({
        id: `${node.id}-${c.id}`, source: node.id, target: c.id,
        type: 'smoothstep', animated: false, style: { stroke: '#94a3b8' },
      });
      return place(c, depth + 1);
    });
    const y = childYs.length
      ? childYs.reduce((a, b) => a + b, 0) / childYs.length
      : (leaf++ * Y_GAP);
    nodes.push({
      id: node.id,
      type: 'drawingNode',
      position: { x: depth * X_GAP, y },
      data: { name: node.name, label: node.label, status: node.status, root: depth === 0 },
    });
    return y;
  };
  place(root, 0);
  return { nodes, edges };
};

// Custom node = a compact drawing card with a "zoom into" action.
const DrawingNode = ({ id, data }) => {
  const navigate = useNavigate();
  return (
    <Box sx={{
      width: 200, bgcolor: '#fff', border: '1px solid',
      borderColor: data.root ? '#ec6e17' : '#e5e7eb',
      borderRadius: 1.5, boxShadow: 1, px: 1.5, py: 1,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#94a3b8' }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{data.name}</Typography>
        {data.status && (
          <Chip size="small" label={data.status}
            sx={{ height: 18, fontSize: 10, bgcolor: statusColor(data.status), color: '#fff' }} />
        )}
      </Box>
      <Typography sx={{ fontSize: 12, color: '#475569' }} noWrap>{data.label || '—'}</Typography>
      <Button size="small" startIcon={<ZoomInIcon sx={{ fontSize: 14 }} />}
        onClick={() => navigate(`/paperless-factory/drawings/${id}`)}
        sx={{ mt: 0.5, p: 0, minWidth: 0, fontSize: 11, textTransform: 'none' }}>
        Zoom in
      </Button>
      <Handle type="source" position={Position.Right} style={{ background: '#94a3b8' }} />
    </Box>
  );
};

const nodeTypes = { drawingNode: DrawingNode };

const AssemblyTree = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rootName, setRootName] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tree = await getAssemblyTree(id);
      setRootName(tree.name);
      const { nodes: n, edges: e } = toFlow(tree);
      setNodes(n);
      setEdges(e);
    } finally {
      setLoading(false);
    }
  }, [id, setNodes, setEdges]);

  useEffect(() => { load(); }, [load]);

  const count = useMemo(() => nodes.length, [nodes]);

  return (
    <Box sx={{ pt: 3, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <IconButton size="small" onClick={() => navigate(`/paperless-factory/drawings/${id}`)}><ArrowBackIcon /></IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Assembly hierarchy — {rootName}
        </Typography>
        <Typography variant="body2" sx={{ color: '#6b7280' }}>
          {count} part(s)
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" variant="outlined" onClick={load}>Refresh</Button>
      </Box>

      <Box sx={{ height: 'calc(100vh - 200px)', minHeight: 420, border: '1px solid #e5e7eb', borderRadius: 1, bgcolor: '#f8fafc' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} color="#e2e8f0" />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        )}
      </Box>
    </Box>
  );
};

export default AssemblyTree;
