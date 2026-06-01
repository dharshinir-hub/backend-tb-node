import { styled } from '@mui/material/styles';
import MuiAppBar from '@mui/material/AppBar';

const drawerWidth = 180;

// AppBar component
export const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  backdropFilter: 'blur(5px)',
  backgroundColor: 'rgba(173, 216, 230, 0.5)', // Light blue glass color
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

export const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  backdropFilter: 'blur(10px)',
  backgroundColor: 'rgba(255, 255, 255, 0.4)',
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

export const Footerbar = styled('footer')(({ theme }) => ({
    width: '100%',
    height: `${theme.mixins.toolbar.minHeight}px`,
    position: 'fixed',
    bottom: 0,
    textAlign: 'right',
    padding: theme.spacing(2),
    backdropFilter: 'blur(10px)',
    backgroundColor: 'black',
    boxShadow: '0 -4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: theme.zIndex.drawer + 1,
  }));
  

export const ContentWrapper = styled('div')({
  overflow: 'auto',
  flexGrow: 1,
});
