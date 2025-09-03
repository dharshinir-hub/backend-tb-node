import React, { useEffect, useState } from 'react';
import './shift.css';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import idImage from '../../../assets/id.png';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Card from '@mui/material/Card';
import { ShiftList ,shiftdelete} from '../../Services/app/shiftservice';
import classNames from 'classnames';
import ShiftAdd from './shiftadd';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
export default function Shift() {
  useEffect(() => {
    getShifts();
  }, []);

  const [datasource, setDatasource] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [open, setOpen] = useState(false);
  const [isDialogOpened, setIsDialogOpened] = useState(false);
  const [dialogOpenCount, setDialogOpenCount] = useState(0);

  const getShifts = async () => {
    try {
      const response = await ShiftList();
      if (Array.isArray(response)) {
        setDatasource(response);
        setShifts(response);
      } else {
        console.error('Unexpected response format:', response);
        setDatasource([]);
        setShifts([]);
      }
      console.log('Fetched shifts:', response);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      setDatasource([]);
      setShifts([]);
    }
  };

  const convertTimes = (time) => {
    if (time !== null) {
      const [hoursStr, minutesStr, secondsStr] = time.split(':').map((str) => parseInt(str, 10));
      const isPM = hoursStr >= 12;
      const hours12Format = isPM ? hoursStr - 12 : hoursStr;
      const convertedTime = `${hours12Format.toString().padStart(2, '0')}:${minutesStr.toString().padStart(2, '0')}:${secondsStr.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
      return convertedTime;
    }
    return null;
  };

  const handleClickOpen = () => {
    if (!isDialogOpened) {
      setOpen(true);
      setIsDialogOpened(true);
    } else {
      setOpen(true);
      setDialogOpenCount((prevCount) => prevCount + 1);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // setIsDialogOpened(false);
    getShifts(); // Call getShifts when the dialog closes

  };
  
  const handleAdd = () => {
    getShifts();
    setOpen(false);
    setIsDialogOpened(false);
  };
  const deleteshift = (id) => {
   
    console.log(' shift delete id:',id); // Handle form submission logic here
    Swal.fire({
      title: 'Are you sure you want to delete?',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, keep it'
    }).then((result) => {
      if (result.isConfirmed) {
        shiftdelete(id).then((response) => {    
          try
          {
            toast.success('Deleted Successfully!', {
              position: "top-center",
              autoClose: 1000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
            });
            getShifts();
          }
          catch (error) {
            toast.error('Something Went Wrong: ' + error.message, {
              position: "top-center",
              autoClose: 1000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
            });
            console.error('Error submitting shift delete:', error);
            
          }
        })
      }
    });

  
  
 
  };
  return (
    <>
      <div className="page">
        <div className='pagecontent'>
          <div className="left-label">
            <h5>Shift Registration</h5>
            <div className="shift_card">
              <div className="shift">
                <div className="play_circle">
                  <img className="volkomn" src={idImage} alt="ID" />
                </div>
                <h2>Day Start Time</h2>
                {shifts.length > 0 && (
                  <h3>{shifts[0]?.shift_start_time}</h3>
                )}
                <div className="status_icon">
                  <div className="status status_first">
                    <span>
                      <AccessTimeIcon />
                    </span>
                    {shifts.length > 0 ? (
                      <p>Working Time 23:59:59</p>
                    ) : (
                      <p>Working Time ---</p>
                    )}
                  </div>
                  <div className="status status_second">
                    <span>
                      <AccessTimeIcon />
                    </span>
                    {shifts.length > 0 ? (
                      <p>Number Of Shift 3</p>
                    ) : (
                      <p>Number Of Shift ---</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="right-label">
            <div className="shift-content">
              <h5>Shift Transaction Registration</h5>
              <div className="add_new">
                <Tooltip title="Add Shift">
                  <IconButton className="circle" onClick={handleClickOpen}>
                    <AddIcon />
                  </IconButton>
                </Tooltip>
                <ShiftAdd
                  open={open}
                  handleClose={handleClose}
                  handleAdd={handleAdd}
                  dialogData={{ new: 'new' }}
                  dialogOpenCount={dialogOpenCount} // Pass the background color to ShiftAdd component
                />
              </div>
            </div>
            <Card className="card_sec">
              <div className="example-container">
                <Table stickyHeader aria-label="sticky table">
                  <TableHead>
                    <TableRow>
                      <TableCell>Shift No</TableCell>
                      <TableCell>Start Time</TableCell>
                      <TableCell>End Time</TableCell>
                      <TableCell>Break Time</TableCell>
                      <TableCell>Module</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(datasource) && datasource.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{row.shift_no || '---'}</TableCell>
                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{convertTimes(row.shift_start_time) || '---'}</TableCell>
                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{convertTimes(row.shift_end_time) || '---'}</TableCell>
                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{row.break_time || '---'}</TableCell>
                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{row.module || '---'}</TableCell>
                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                          <Tooltip title="Delete Shift">
                          <IconButton onClick={() => deleteshift(row._id)}>
                            <DeleteIcon sx={{ color: 'white' }} />
                          </IconButton>

                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}