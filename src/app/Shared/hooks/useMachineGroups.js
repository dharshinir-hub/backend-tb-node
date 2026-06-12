import { useState, useEffect } from "react";
import { customerbaseddevices, customerbasedshift } from "../../Services/app/operatorservice";

const naturalSort = (arr) =>
  [...arr].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

export const useMachineGroups = (customerId, singleSelect = false) => {
  const [devices, setDevices] = useState([]);
  const [deviceNameID, setDeviceNameID] = useState([]);
  const [machineGroups, setMachineGroups] = useState([]);
  const [availableMachines, setAvailableMachines] = useState([]);
  const [selectedMachines, setSelectedMachines] = useState(singleSelect ? "" : []);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const userDetails = JSON.parse(localStorage.getItem("userDetails") || "{}");
  const groupsOnly = Array.isArray(userDetails?.groups) ? userDetails.groups : null;
  const hasGroupsAccess = Array.isArray(groupsOnly) && groupsOnly.length > 0;

  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];
      setDevices(devicesList);
      const deviceNameId = devicesList.map((d) => ({
        id: d?.id?.id,
        name: d?.name,
      }));
      setDeviceNameID(deviceNameId);
      return devicesList;
    } catch (err) {
      console.error("Failed to fetch devices", err);
      return [];
    }
  };

  const fetchMachineGroups = async (devicesList = []) => {
    try {
      const result = await customerbasedshift(customerId, "machinegroups");
      const groupsRaw = result?.[0]?.value ?? [];

      // let filteredGroups = [];
      // if (hasGroupsAccess) {
      //   filteredGroups = groupsRaw.filter((grp) => groupsOnly.includes(grp.code));
      // } else {
      //   filteredGroups = groupsRaw;
      // }
      // Allow all machine groups to all roles
      const filteredGroups = groupsRaw;

      setMachineGroups(filteredGroups);

      if (filteredGroups.length === 1) {
        const singleGroup = filteredGroups[0];
        const machines = naturalSort(singleGroup.machines || []);
        setSelectedGroups([singleGroup.name]);
        setAvailableMachines(machines);
        setSelectedMachines(singleSelect ? machines[0] || "" : machines);
      } else if (filteredGroups.length > 1) {
        const allMachines = naturalSort(filteredGroups.flatMap((g) => g.machines || []));
        const allGroupNames = filteredGroups.map((g) => g.name);
        setSelectedGroups(allGroupNames);
        setAvailableMachines(allMachines);
        setSelectedMachines(singleSelect ? allMachines[0] || "" : allMachines);
      } else {
        const deviceNames = naturalSort(devicesList.map((d) => d.name).filter(Boolean));
        setSelectedGroups([]);
        setAvailableMachines(deviceNames);
        setSelectedMachines(singleSelect ? deviceNames[0] || "" : deviceNames);
      }

      return filteredGroups;
    } catch (error) {
      console.error("Error fetching machine groups:", error);
      const deviceNames = naturalSort(devicesList.map((d) => d.name).filter(Boolean));
      setMachineGroups([]);
      setSelectedGroups([]);
      setAvailableMachines(deviceNames);
      setSelectedMachines(singleSelect ? deviceNames[0] || "" : deviceNames);
      return [];
    }
  };

  const initialize = async () => {
    setLoading(true);
    const devicesList = await fetchDevices();
    await fetchMachineGroups(devicesList); 
    setLoading(false);
  };

  const handleGroupChange = (selectedGroupNames = []) => {
    let updatedGroups = [...selectedGroupNames];
    if (selectedGroupNames.includes("all")) {
      if (selectedGroups.length === machineGroups.length) {
        updatedGroups = [];
      } else {
        updatedGroups = machineGroups.map((g) => g.name);
      }
    }
    setSelectedGroups(updatedGroups);
    if (updatedGroups.length === 0) {
      setAvailableMachines([]);
      setSelectedMachines(singleSelect ? "" : []);
      return;
    }
    const selectedMachinesCombined = naturalSort(
      machineGroups.filter((g) => updatedGroups.includes(g.name)).flatMap((g) => g.machines || [])
    );
    setAvailableMachines(selectedMachinesCombined);
    setSelectedMachines(
      singleSelect ? selectedMachinesCombined[0] || "" : selectedMachinesCombined
    );
  };

  const handleMachineChange = (selectedValue) => {
    if (singleSelect) {
      setSelectedMachines(selectedValue);
    } else {
      const selectedMachineValues = selectedValue;
      if (selectedMachineValues.includes("all")) {
        if (selectedMachines.length === availableMachines.length) {
          setSelectedMachines([]);
        } else {
          setSelectedMachines(availableMachines);
        }
        return;
      }
      setSelectedMachines(selectedMachineValues);
    }
  };

  const getDeviceObjectsForMachines = (machineNames = []) => {
    if (!Array.isArray(machineNames) || machineNames.length === 0) return [];
    return devices.filter((d) => machineNames.includes(d.name));
  };

  const isAllMachinesSelected =
    !singleSelect &&
    selectedMachines.length === availableMachines.length &&
    availableMachines.length > 0;

  const showMachineGroupsDropdown = machineGroups.length > 1;

  useEffect(() => {
    if (customerId) {
      initialize();
    }
  }, [customerId]);

  return {
    devices,
    deviceNameID,
    machineGroups,
    availableMachines,
    selectedMachines,
    selectedGroups,
    loading,
    hasGroupsAccess,
    isAllMachinesSelected,
    showMachineGroupsDropdown,
    handleGroupChange,
    handleMachineChange,
    setSelectedMachines,
    getDeviceObjectsForMachines,
    refreshMachineGroups: fetchMachineGroups,
  };
};
