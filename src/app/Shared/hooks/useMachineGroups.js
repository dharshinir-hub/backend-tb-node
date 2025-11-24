// hooks/useMachineGroups.js
import { useState, useEffect } from "react";
import { customerbaseddevices,customerbasedshift } from "../../Services/app/operatorservice";

export const useMachineGroups = (customerId) => {
    const [devices, setDevices] = useState([]);
    const [deviceNameID, setDeviceNameID] = useState([]);
    const [machineGroups, setMachineGroups] = useState([]);
    const [availableMachines, setAvailableMachines] = useState([]);
    const [selectedMachines, setSelectedMachines] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState("all");
    const [loading, setLoading] = useState(true);

    // Get user groups from localStorage
    const userDetails = JSON.parse(localStorage.getItem("userDetails") || "{}");
    const groupsOnly = userDetails?.groups || [];
    const hasGroupsAccess = userDetails && userDetails.hasOwnProperty('groups') && groupsOnly.length > 0;

    const fetchDevices = async () => {
        try {
            const result = await customerbaseddevices(customerId, 100, 0);
            const devicesList = result.data || [];
            setDevices(devicesList);
            const deviceNameId = (result.data || []).map((d) => ({
                id: d?.id?.id,
                name: d?.name
            }));
            setDeviceNameID(deviceNameId);
            return devicesList;
        } catch (err) {
            console.error("Failed to fetch devices", err);
            return [];
        }
    };

    const fetchMachineGroups = async () => {
        try {
            const result = await customerbasedshift(customerId, "machinegroups");
            const groupsRaw = result?.[0]?.value ?? [];

            let filteredGroups = [];
            
            if (hasGroupsAccess) {
                // Filter based on user group access
                filteredGroups = groupsRaw.filter((grp) =>
                    groupsOnly.includes(grp.code)
                );
            } else {
                // If groups key doesn't exist or groupsOnly is empty, show all groups
                filteredGroups = groupsRaw;
            }

            setMachineGroups(filteredGroups);

            // Set initial machines based on groups
            if (filteredGroups.length === 1) {
                const singleGroup = filteredGroups[0];
                setSelectedGroup(singleGroup.name);
                setAvailableMachines(singleGroup.machines || []);
                setSelectedMachines(singleGroup.machines || []);
            } else if (filteredGroups.length > 1) {
                const allMachines = filteredGroups.flatMap((g) => g.machines || []);
                setAvailableMachines(allMachines);
                setSelectedMachines(allMachines);
            } else {
                // No groups - get from devices
                const deviceNames = devices.map(d => d.name).filter(name => name);
                setAvailableMachines(deviceNames);
                setSelectedMachines(deviceNames);
            }

            return filteredGroups;
        } catch (error) {
            console.error("Error fetching machine groups:", error);
            setMachineGroups([]);
            
            // Fallback to devices if groups fetch fails
            const deviceNames = devices.map(d => d.name).filter(name => name);
            setAvailableMachines(deviceNames);
            setSelectedMachines(deviceNames);
            return [];
        }
    };

    const initialize = async () => {
        setLoading(true);
        await fetchDevices();
        await fetchMachineGroups();
        setLoading(false);
    };

    const handleGroupChange = (groupName) => {
        setSelectedGroup(groupName);

        if (groupName === "all") {
            const allMachines = machineGroups.flatMap(g => g.machines || []);
            setAvailableMachines(allMachines);
            setSelectedMachines(allMachines);
        } else {
            const found = machineGroups.find(g => g.name === groupName);
            const groupMachines = found?.machines ?? [];
            setAvailableMachines(groupMachines);
            setSelectedMachines(groupMachines);
        }
    };

    const handleMachineChange = (selectedMachineValues) => {
        if (selectedMachineValues.includes("all")) {
            if (selectedMachines.length === availableMachines.length) {
                setSelectedMachines([]);
            } else {
                setSelectedMachines(availableMachines);
            }
            return;
        }
        
        const updated = selectedMachineValues;
        if (updated.length === availableMachines.length) {
            setSelectedMachines(availableMachines);
        } else {
            setSelectedMachines(updated);
        }
    };

    const getDeviceObjectsForMachines = (machineNames = []) => {
        if (!Array.isArray(machineNames) || machineNames.length === 0) return [];
        const matched = devices.filter((d) => machineNames.includes(d.name));
        return matched;
    };

    const isAllMachinesSelected = selectedMachines.length === availableMachines.length && availableMachines.length > 0;
    const showMachineGroupsDropdown = hasGroupsAccess && machineGroups.length > 1;

    useEffect(() => {
        if (customerId) {
            initialize();
        }
    }, [customerId]);

    return {
        // State
        devices,
        deviceNameID,
        machineGroups,
        availableMachines,
        selectedMachines,
        selectedGroup,
        loading,
        
        // Computed values
        hasGroupsAccess,
        isAllMachinesSelected,
        showMachineGroupsDropdown,
        
        // Functions
        handleGroupChange,
        handleMachineChange,
        setSelectedMachines,
        getDeviceObjectsForMachines,
        refreshMachineGroups: fetchMachineGroups
    };
};