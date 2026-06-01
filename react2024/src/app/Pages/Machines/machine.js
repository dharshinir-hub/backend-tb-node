import { useState, useEffect } from 'react';
import { Tooltip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { TimeField } from '@mui/x-date-pickers/TimeField';
import '../../Pages/Machines/machine.css';
import { customerbasedshift, shiftadd, Deviceattributeget } from '../../Services/app/masterservice';
import { customerbaseddevices } from '../../Services/app/andondashboardservice';
import { Downtimeadd } from '../../Services/app/masterservice';

import Swal from 'sweetalert2';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';

import 'react-time-picker/dist/TimePicker.css';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import { MobileTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { DemoItem } from '@mui/x-date-pickers/internals/demo';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

// Function to convert seconds to HH:mm:ss format
const formatSecondsToTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return 'Not set';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const MachineList = () => {
    // Dialog state
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editDialogData, setEditDialogData] = useState(null);
    const [dialogOpenCount, setDialogOpenCount] = useState(0);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    const [timeValue, setTimeValue] = useState(dayjs('00:01:00', 'HH:mm:ss'));
    const customerId = localStorage.getItem('CustomerID');
    const [devices, setDevices] = useState([]);
    const [deviceThresholds, setDeviceThresholds] = useState({});

    const handleOpenEditDialog = async (rowData) => {
        const itemId = rowData.id?.$oid || rowData.id;
        const key = 'downtime_threasold';
        let defaultTime = dayjs('00:01:00', 'HH:mm:ss');
    
        try {
            const response = await Deviceattributeget(itemId.id, key);
            if (response?.length > 0) {
                const seconds = parseInt(response[0].value, 10) || 60;
                const timeStr = formatSecondsToTime(seconds);
                defaultTime = dayjs(timeStr, 'HH:mm:ss');
                if (defaultTime) {
                    setOpenEditDialog(true);
                }
                 
                  
            }
        } catch (error) {
            console.error('Error fetching downtime threshold:', error);
            if (defaultTime) {
                setOpenEditDialog(true);
            }
        }
    
        setSelectedDeviceId(itemId);
        setTimeValue(defaultTime);
        if (defaultTime) {
            setOpenEditDialog(true);
        }
       
    };

    const handleSaveThreshold = async () => {
        if (!timeValue) return;

        const totalSeconds = timeValue.diff(dayjs().startOf('day'), 'second');

        try {
            await Downtimeadd('DEVICE', selectedDeviceId.
                id, 'SERVER_SCOPE', {
                downtime_threasold: totalSeconds,
                lastUpdateTs: Date.now()
            });

            setDeviceThresholds(prev => ({
                ...prev,
                [selectedDeviceId]: totalSeconds
            }));

            Swal.fire('Success', 'Downtime threshold updated.', 'success');
            getShifts();
        } catch (err) {
            console.error('Update error:', err);
            Swal.fire('Error', 'Failed to update downtime.', 'error');
        } finally {
            setOpenEditDialog(false);
        }
    };

    const getShifts = async () => {
        try {
            const { data: allDevices = [] } = await customerbaseddevices(customerId, 100, 0);
            setDevices(allDevices);
            
            const thresholds = {};
            for (const device of allDevices) {
                try {
                    const response = await Deviceattributeget(device.id.id, 'downtime_threasold');
                    thresholds[device.id.id || device.id] = response?.[0]?.value || null;
                } catch (error) {
                    console.error(`Error fetching threshold for device ${device.id}:`, error);
                    thresholds[device.id.id || device.id] = null;
                }
            }
            setDeviceThresholds(thresholds);
        } catch (error) {
            console.error('Error fetching devices:', error);
        }
    };

    useEffect(() => {
        getShifts();
    }, []);

    return (
        <div className="pages">
            <div className="pagecontents">
                <div className="left-labels">
                    <div className="shift-content">
                        <h5>Machines List</h5>
                    </div>
                </div>

                <div className="idle_reason_list">
                    {devices?.length > 0 ? (
                        [...new Map(devices.map(device => 
                            [device.id?.$oid || device.id, device])).values()]
                            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                            .map((item) => {
                                const itemId = item.id?.$oid || item.id;
                                const threshold = deviceThresholds[item.id.id || item.id] ?? 'Not set';

                                return (
                                    <div className="idle_reason_item" key={itemId} data-id={item.code}>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '4px'}}>
                                                <span style={{fontWeight: 600, fontSize: '20px'}}>Machine Name:</span>
                                                <span style={{color: 'black'}}>{item.name}</span>
                                            </div>
                                            <div 
                                                style={{
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '8px', 
                                                    padding: '6px 12px', 
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    background: '#80808040'
                                                }} 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenEditDialog(item);
                                                }}
                                            >
                                                <span style={{fontWeight: 600, fontSize: '20px'}}>Downtime Trigger Duration:</span>
                                                <span style={{color: 'black'}}>{formatSecondsToTime(threshold)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                    ) : (
                        <div style={{ margin: '2rem', color: '#888' }}>No devices found.</div>
                    )}
                </div>

                <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="500px" >
                    <DialogTitle>Edit Downtime Duration</DialogTitle>
                    <DialogContent>
                    <div className={`form_field time_field_bg`}>
                  <DemoItem label="Downtime Duration *" className="white-label">
                    <LocalizationProvider
                     dateAdapter={AdapterDayjs}>
                      <TimePicker                    
                        value={timeValue}
                        onChange={(newValue) => setTimeValue(newValue)}
                        views={['hours', 'minutes', 'seconds']}
                        openTo="hours"
                        format="HH:mm:ss"
                        ampm={false}
                        InputLabelProps={{ required: true }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: 'black',
                            },
                            '&:hover fieldset': {
                              borderColor: 'black',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: 'orange',
                            },
                            '& .MuiOutlinedInput-input': {
                              color: 'black',
                            },
                            '&.Mui-focused .MuiOutlinedInput-input': {
                              caretColor: 'orange',
                            },
                            '&::placeholder': {
                              color: 'black',
                              opacity: 1,
                            },
                          },
                        }}
                      />
                    </LocalizationProvider>
                  </DemoItem>                  
                </div>
                    </DialogContent>
                    <DialogActions>
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() => setOpenEditDialog(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff9800' }} onClick={handleSaveThreshold}>Save</Button>
                    </DialogActions>
                </Dialog>
            </div>
        </div>
    );
};

export default MachineList;