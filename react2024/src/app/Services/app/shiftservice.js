import axiosInstance from '../core/axiosconfig'; 

export const ShiftList = async () => {
  try {
    const response = await axiosInstance.get('shift/shiftlist', {}); // No need to specify headers or baseURL
    console.log('shift response', response);
    return response.data;
  } catch (error) {
    console.error('Error fetching shift list:', error);
    throw error; // Rethrow the error to handle it in the calling function
  }
};

export const shiftgetmodule =async () =>{
  try {
    const response = await axiosInstance.get('machine/modules', {}); // No need to specify headers or baseURL
    console.log('shift module response', response);
    return response.data;
  } catch (error) {
    console.error('Error fetching shift module list:', error);
    throw error; // Rethrow the error to handle it in the calling function
  }
}

export const shiftcreate =async(data)=>{
  try{
    const response = await axiosInstance.post('shift/shiftinsert',data); // No need to specify headers or baseURL
    console.log('shift module response', response);
    return response.data;
  }
  catch(error){
    console.error('Error fetching shift create :', error);
    throw error;
  }
}

export const shiftdelete = async (id) => {
  try {
    const response = await axiosInstance.delete(`shift/shiftdeleteby/${id}`);
    console.log('shift delete response', response);
    return response.data;
  } catch (error) {
    console.error('Error deleting shift:', error);
    throw error;
  }
};