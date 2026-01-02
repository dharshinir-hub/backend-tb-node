import Company from '../../Pages/Company/company'
import GrafanaEmbed from '../../Pages/MachinesMM/machinemm';
import NewDeviceOee from '../../Pages/NewDeviceOee/newdeviceoee';
import OperatorDetails from '../../Pages/Operatordetails/operatordeatil';
import MachineList from '../../Pages/Machines/machine';
import ShiftRegistration from '../../Pages/Shiftregistration/shiftreg';
import OperatorRegistration from '../../Pages/Operatorregistration/operatorreg';
import UserRegistration from '../../Pages/Userregistration/userreg';
import ComponentRegistration from '../../Pages/Componentregistration/componentreg';
import ReasonRegistration from '../../Pages/Reasonregistration/reasonreg';
import Analytics from '../../Pages/Analytics/analytics';
import NewAnalytics from '../../Pages/New-Analytics/new-analytics';
import MachineGroup from '../../Pages/Machinegroup/machinegroup';
import NotificationCenter from '../../Pages/NotificationCenter/notificationcenter';
import MachineReport from '../../Pages/Reports/report';
import LeaderBoard from '../../Pages/LeaderBoard/leaderboard';

export const COMPONENT_REGISTRY = {
  "shift-registration": ShiftRegistration,
  "component-registration": ComponentRegistration,
  "operator-registration": OperatorRegistration,
  "user-registration": UserRegistration,
  "reason-registration": ReasonRegistration,
  "machines": MachineList,
  "company": Company,
  "operator-details": OperatorDetails,
  "machinemm": GrafanaEmbed,
  "deviceoee": NewDeviceOee,
  "production-analysis": Analytics,
  "analytics": NewAnalytics,
  "machines-group": MachineGroup,
  "notification-center": NotificationCenter,
  "reports": MachineReport,
  "leaderboard": LeaderBoard

};
