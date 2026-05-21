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
import OnePageDashboard from '../../Pages/Onepage-Dashboard/OnePageDashboard';
import ReasonGroup from '../../Pages/Reasongroup/reasongroup';
import GroupRegistration from '../../Pages/Groupregistration/groupregistration';
import ProductionOverview from '../../Pages/Productionoverview/productionoverview';
import Settings from '../../Pages/Settings/settings';
import Metrics from '../../Pages/Metrics/metrics';
import QualityBoard from '../../Pages/QualityBoard/qualityboard';
import BlueCard from '../../Pages/BlueCardScreen/bluecardscreen';
import BluecardDetails from '../../Pages/BlueCardScreen/bluecarddetails';
import BluecardReport from '../../Pages/BlueCardScreen/bluecardreport';
import MachineStatusDashboard from '../../Pages/MachineStatusDashboard/MachineStatusDashboard';
import OperatorPerformanceDashboard from '../../Pages/Operator-Performance-Dashboard/OperatorPerformanceDashboard';
import AnalyticsV2 from '../../Pages/Analytics-V2/AnalyticsV2';
import ErpJson from '../../Pages/ErpjsonBuild/erpjson';
import ErpReportSchedule from '../../Pages/ErpReportSchedules/erpreportschedule';
import ErpReport from '../../Pages/Erpreport/erpreport';
import HolidayList from '../../Pages/Holiday-List/HolidayList';



export const COMPONENT_REGISTRY = {
  "shift-registration": ShiftRegistration,
  "component-registration": ComponentRegistration,
  "operator-registration": OperatorRegistration,
  "user-registration": UserRegistration,
  "reason-registration": ReasonRegistration,
  "machines": MachineList,
  // "company": Company,
  "operator-details": OperatorDetails,
  "machinemm": GrafanaEmbed,
  "deviceoee": NewDeviceOee,
  "production-analysis": Analytics,
  "analytics": AnalyticsV2,
  "machines-group": MachineGroup,
  "notification-center": NotificationCenter,
  "reports": MachineReport,
  "operator-leaderboard": LeaderBoard,
  "kpi-dashboard" : OnePageDashboard,
  "reason-group" : ReasonGroup,
  "production-overview" : ProductionOverview,
  "group" : GroupRegistration,
  "settings" : Settings,
  "production-metrics" : Metrics,
  "quality" : QualityBoard,
  "bluecard": BlueCard,
  "bluecarddetails" : BluecardDetails,
  "bluecardreport" : BluecardReport,
  "machine-status": MachineStatusDashboard,
  "operator-performance": OperatorPerformanceDashboard,
  "erpreport": ErpReport,
  "erpjson": ErpJson,
  "erpreportschedule": ErpReportSchedule,
  "holiday-list": HolidayList
};
