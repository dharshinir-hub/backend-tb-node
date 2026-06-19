import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Handle, Position, useNodesState, useEdgesState,
  BaseEdge, EdgeLabelRenderer, getSmoothStepPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Box, Typography, Button, Chip, CircularProgress, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Menu, Snackbar, Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import {
  getAssemblyTree, getDrawings, addBomLink, removeBomLink,
} from '../../../Services/app/zumenservice';
import { AuthImg } from '../../../Services/app/zumendocservice';
import { getSetting } from '../../../Services/app/zumensettings';
import { alertCreated, alertDeleted, alertWarning, alertError } from '../ppwAlerts';

// Module-level bridge so the custom edge badge can call back into the component.
const edgeBadge = { handler: () => {} };

// Custom edge: smoothstep line with a "›" badge that's ALWAYS shown, but only
// clickable (→ Disconnect/Cancel) when in edit-hierarchy mode.
const ConnectorEdge = ({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) => {
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const editable = !!(data && data.editMode);
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: '#94a3b8', strokeWidth: 1.5 }} />
      <EdgeLabelRenderer>
        <div style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all', zIndex: 10 }}>
          <button type="button" onClick={(e) => { if (editable) edgeBadge.handler(e, source, target); }}
            style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', border: '2px solid #3b82f6', color: '#3b82f6', cursor: editable ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, lineHeight: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.15)', padding: 0 }}>›</button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
const edgeTypes = { connector: ConnectorEdge };

const STATUS_COLORS = {
  'New Model': '#3b82f6', 'In Production': '#10b981', Approved: '#10b981',
  Cancelled: '#ef4444', Hold: '#f59e0b',
};
const statusColor = (s) => STATUS_COLORS[s] || '#6b7280';

const X_GAP = 330;
const Y_GAP = 104;

// Flatten the nested assembly tree into React Flow nodes + edges with a tidy
// left-to-right layered layout (x = depth, y = balanced over children).
const toFlow = (root, opts = {}) => {
  const { autoNumber = true, showQuantity = true, showThumbnails = true } = opts;
  const nodes = [];
  const edges = [];
  let leaf = 0;
  // `number` is the hierarchical BOM number (root = '', children 1, 1.1, 1.2…).
  const place = (node, depth, number) => {
    const childYs = node.children.map((c, idx) => {
      edges.push({
        id: `${node.id}-${c.id}`, source: node.id, target: c.id,
        type: 'connector', animated: false,
      });
      const childNo = number ? `${number}.${idx + 1}` : `${idx + 1}`;
      return place(c, depth + 1, childNo);
    });
    const y = childYs.length
      ? childYs.reduce((a, b) => a + b, 0) / childYs.length
      : (leaf++ * Y_GAP);
    nodes.push({
      id: node.id,
      type: 'drawingNode',
      position: { x: depth * X_GAP, y },
      data: {
        name: node.name, label: node.label, status: node.status, material: node.material,
        inventory: node.inventory, thumb: node.thumbnailResourceId,
        hasChildren: (node.children || []).length > 0, root: depth === 0,
        number: autoNumber ? number : '', showQuantity, showThumbnails,
      },
    });
    return y;
  };
  place(root, 0, '');
  return { nodes, edges };
};

// Custom node = a drawing card with thumbnail + "zoom into" (mirrors demo Zumen).
const DrawingNode = ({ id, data }) => {
  const navigate = useNavigate();
  return (
    <Box sx={{
      width: 250, bgcolor: '#fff', border: '1px solid',
      borderColor: data.root ? '#ec6e17' : '#e5e7eb',
      borderRadius: 1.5, boxShadow: 1, p: 1, display: 'flex', gap: 1, position: 'relative',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#94a3b8' }} />
      {/* Thumbnail (hidden when "Show child thumbnails" is off in Assembly settings) */}
      {data.showThumbnails !== false && (
        <Box sx={{ width: 64, height: 56, flexShrink: 0, border: '1px solid #eef1f4', borderRadius: 1, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {data.thumb
            ? <AuthImg doc={{ resourceId: data.thumb }} alt={data.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} fallback={<InsertDriveFileIcon sx={{ fontSize: 28, color: '#cbd5e1' }} />} />
            : <InsertDriveFileIcon sx={{ fontSize: 28, color: '#cbd5e1' }} />}
        </Box>
      )}
      {/* Details */}
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            {data.number && (
              <Chip size="small" label={data.number}
                sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: '#eef2ff', color: '#4338ca', flexShrink: 0 }} />
            )}
            <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>{data.name}</Typography>
          </Box>
          {data.status && (
            <Chip size="small" label={data.status}
              sx={{ height: 18, fontSize: 10, bgcolor: statusColor(data.status), color: '#fff', flexShrink: 0 }} />
          )}
        </Box>
        <Typography sx={{ fontSize: 12, color: '#475569' }} noWrap>{data.label || '—'}</Typography>
        {(data.material || (data.showQuantity !== false && data.inventory)) && (
          <Typography sx={{ fontSize: 10, color: '#94a3b8' }} noWrap>
            {data.material || ''}{data.material && data.showQuantity !== false && data.inventory ? ' · ' : ''}{data.showQuantity !== false && data.inventory ? `stock: ${data.inventory}` : ''}
          </Typography>
        )}
        <Button size="small" startIcon={<VisibilityOutlinedIcon sx={{ fontSize: 14 }} />}
          onClick={(e) => { e.stopPropagation(); navigate(`/paperless-factory/drawings/${id}`, { state: { from: window.location.pathname + window.location.search } }); }}
          sx={{ mt: 0.25, p: 0, minWidth: 0, fontSize: 11, textTransform: 'none' }}>
          View
        </Button>
      </Box>
      <Handle type="source" position={Position.Right} style={{ background: '#94a3b8' }} />
    </Box>
  );
};

const nodeTypes = { drawingNode: DrawingNode };

const AssemblyTree = ({ embedded = false, drawingId: propId }) => {
  const { id: routeId } = useParams();
  const id = propId || routeId;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rootName, setRootName] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [editMode, setEditMode] = useState(false);
  const [snack, setSnack] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [parentId, setParentId] = useState(id);
  const [childId, setChildId] = useState('');
  const [allDrawings, setAllDrawings] = useState([]);
  const [badgeMenu, setBadgeMenu] = useState(null); // { anchorEl, source, target }
  const [nodeMenu, setNodeMenu] = useState(null); // { x, y, nodeId }
  // Assembly settings (depth / numbering / quantity / thumbnails) from Settings.
  const [asmCfg, setAsmCfg] = useState({ relationType: 'Contains', maxDepth: 5, autoNumber: true, showQuantity: true, showThumbnails: true });
  useEffect(() => { getSetting('zumenAssemblySettings').then((s) => s && setAsmCfg((c) => ({ ...c, ...s }))).catch(() => {}); }, []);
  const editModeRef = useRef(false);
  editModeRef.current = editMode;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tree = await getAssemblyTree(id, Number(asmCfg.maxDepth) || 8);
      setRootName(tree.name);
      const { nodes: n, edges: e } = toFlow(tree, asmCfg);
      setNodes(n);
      setEdges(e.map((ed) => ({ ...ed, data: { editMode: editModeRef.current } })));
    } finally {
      setLoading(false);
    }
  }, [id, setNodes, setEdges, asmCfg]);

  useEffect(() => { load(); }, [load]);
  // Show/hide the "›" badges when edit mode toggles.
  useEffect(() => { setEdges((es) => es.map((e) => ({ ...e, data: { ...e.data, editMode } }))); }, [editMode, setEdges]);

  const count = useMemo(() => nodes.length, [nodes]);

  // Drag from one node's right handle to another's left handle => create a BOM link.
  const onConnect = useCallback(async (params) => {
    if (!params.source || !params.target || params.source === params.target) return;
    try {
      await addBomLink(params.source, params.target);
      setSnack('Link added');
      await load();
    } catch (e) {
      setSnack('Add link failed: ' + (e?.response?.data?.message || e.message));
    }
  }, [load]);

  // Click an edge in edit mode => remove that parent->child link.
  const onEdgeClick = useCallback(async (evt, edge) => {
    if (!editMode) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm('Remove this assembly link?')) return;
    try {
      await removeBomLink(edge.source, edge.target);
      setSnack('Link removed');
      await load();
    } catch (e) {
      setSnack('Remove failed: ' + (e?.response?.data?.message || e.message));
    }
  }, [editMode, load]);

  const openAdd = async () => {
    setAddOpen(true);
    setParentId(id);
    if (!allDrawings.length) {
      const res = await getDrawings({ pageSize: 200 });
      setAllDrawings((res.data || []).map((a) => ({ id: a.id.id, number: a.name, product: a.label || '' })));
    }
  };

  // Wire the edge "›" badge → open the Disconnect / Cancel menu.
  edgeBadge.handler = (e, source, target) => { e.stopPropagation(); setBadgeMenu({ anchorEl: e.currentTarget, source, target }); };
  const disconnectEdge = async () => {
    const m = badgeMenu; setBadgeMenu(null);
    if (!m) return;
    try {
      await removeBomLink(m.source, m.target);
      // Remove only the connection line; both nodes stay on the canvas.
      setEdges((es) => es.filter((e) => !(e.source === m.source && e.target === m.target)));
      alertDeleted('Connection removed.');
    } catch (err) { alertError(err?.response?.data?.message || err.message); }
  };

  // Node click → Remove / Cancel menu (removes that part from the assembly).
  const removeNode = async () => {
    const nm = nodeMenu; setNodeMenu(null);
    if (!nm) return;
    if (nm.nodeId === id) { alertWarning('Not allowed', 'You can’t remove the root part.'); return; }
    const touching = edges.filter((e) => e.source === nm.nodeId || e.target === nm.nodeId);
    try {
      for (const e of touching) { try { await removeBomLink(e.source, e.target); } catch (x) { /* skip */ } }
      setNodes((ns) => ns.filter((n) => n.id !== nm.nodeId));
      setEdges((es) => es.filter((e) => e.source !== nm.nodeId && e.target !== nm.nodeId));
      alertDeleted('Part removed from the assembly.');
    } catch (err) { alertError(err?.response?.data?.message || err.message); }
  };

  const addChild = async () => {
    if (!parentId || !childId || parentId === childId) { alertWarning('Missing selection', 'Pick a parent and a different child.'); return; }
    try {
      await addBomLink(parentId, childId);
      setAddOpen(false);
      setChildId('');
      await load();
      alertCreated('Part added to the assembly!');
    } catch (e) {
      alertError(e?.response?.data?.message || e.message);
    }
  };

  return (
    <Box sx={{ pt: embedded ? 0 : 3, px: embedded ? 0 : 2, ...(embedded && { height: '100%', display: 'flex', flexDirection: 'column' }) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: embedded ? 1 : 2, flexShrink: 0 }}>
        {!embedded && <IconButton size="small" onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>}
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: embedded ? 15 : undefined }}>
          {embedded ? 'Assembly drawing' : `Assembly hierarchy — ${rootName}`}
        </Typography>
        <Typography variant="body2" sx={{ color: '#6b7280' }}>
          {count} part(s)
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {editMode && (
          <Button size="small" variant="outlined" startIcon={<AccountTreeIcon />} sx={{ textTransform: 'none' }} onClick={openAdd}>
            Add part
          </Button>
        )}
        <Button size="small" variant={editMode ? 'contained' : 'outlined'} sx={{ textTransform: 'none', ...(editMode && { bgcolor: '#475569' }) }}
          onClick={() => setEditMode((m) => !m)}>
          {editMode ? 'Done editing' : 'Edit hierarchy'}
        </Button>
        {editMode && (
          <Button size="small" variant="outlined" color="inherit" sx={{ textTransform: 'none', color: '#64748b', borderColor: '#cbd5e1' }}
            onClick={() => { setEditMode(false); load(); }}>
            Cancel
          </Button>
        )}
        {embedded && (
          <Button size="small" variant="outlined" startIcon={<OpenInFullIcon sx={{ fontSize: 16 }} />}
            onClick={() => navigate(`/paperless-factory/drawings/${id}/assembly`)} sx={{ textTransform: 'none' }}>
            Full view
          </Button>
        )}
      </Box>
      {editMode && (
        <Typography sx={{ fontSize: 12, color: '#ec6e17', mb: 1 }}>
          Edit mode: drag from a node’s right dot to another node’s left dot to link parts · click a line to remove it · or use “Add part”.
        </Typography>
      )}

      <Box sx={{ ...(embedded ? { flexGrow: 1, minHeight: 360 } : { height: 'calc(100vh - 200px)', minHeight: 420 }), border: '1px solid #e5e7eb', borderRadius: 1, bgcolor: '#f8fafc' }}>
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
            onConnect={editMode ? onConnect : undefined}
            onNodeClick={(e, node) => { if (editMode) setNodeMenu({ x: e.clientX, y: e.clientY, nodeId: node.id }); }}
            nodesConnectable={editMode}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} color="#eef2f7" />
          </ReactFlow>
        )}
      </Box>

      {/* Add-part dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Add part to assembly</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 1.5, mt: 1 }}>
            <TextField select label="Parent part" size="small" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              {nodes.map((n) => (<MenuItem key={n.id} value={n.id}>{n.data.name} — {n.data.label}</MenuItem>))}
            </TextField>
            <TextField select label="Child part to add" size="small" value={childId} onChange={(e) => setChildId(e.target.value)}
              helperText={allDrawings.filter((d) => d.id !== parentId && !nodes.some((n) => n.id === d.id)).length === 0 ? 'No other drawings to add — create the sub-part in Drawings first.' : ' '}>
              {allDrawings
                .filter((d) => d.id !== parentId && !nodes.some((n) => n.id === d.id)) // exclude the parent + parts already in this tree
                .map((d) => (<MenuItem key={d.id} value={d.id}>{d.number} — {d.product}</MenuItem>))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" sx={{ bgcolor: '#ec6e17' }} onClick={addChild}>Add</Button>
        </DialogActions>
      </Dialog>

      {/* Connector "›" badge menu */}
      <Menu anchorEl={badgeMenu?.anchorEl} open={!!badgeMenu} onClose={() => setBadgeMenu(null)}>
        <MenuItem onClick={disconnectEdge} sx={{ color: '#ef4444' }}>Disconnect</MenuItem>
        <MenuItem onClick={() => setBadgeMenu(null)}>Cancel</MenuItem>
      </Menu>

      {/* Node menu (Remove / Cancel) */}
      <Menu open={!!nodeMenu} onClose={() => setNodeMenu(null)} anchorReference="anchorPosition"
        anchorPosition={nodeMenu ? { top: nodeMenu.y, left: nodeMenu.x } : undefined}>
        <MenuItem onClick={removeNode} sx={{ color: '#ef4444' }}>Remove</MenuItem>
        <MenuItem onClick={() => setNodeMenu(null)}>Cancel</MenuItem>
      </Menu>

      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack('')} message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
};

export default AssemblyTree;
