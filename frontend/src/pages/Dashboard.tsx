import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  useReactTable, 
  getCoreRowModel, 
  flexRender, 
  createColumnHelper,
  getSortedRowModel,
  type SortingState
} from '@tanstack/react-table';
import { 
  Users, 
  Key, 
  Link2, 
  LogOut, 
  Search, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ChevronRight,
  MessageSquare,
  Building2,
  Trash2,
  Edit,
  Activity,
  History,
  Clipboard,
  X,
  ArrowRight,
  ArrowLeft,
  ChevronDown
} from 'lucide-react';
import { getAuthHeaders, removeSession, type UserSession } from '../utils/auth';

interface DashboardProps {
  session: UserSession;
  onLogout: () => void;
}

interface CustomerRow {
  sm_ID: number;
  sm_TEXT: string | null;
  sm_SERIALNO: string;
  sm_ISACTIVE: string;
  sm_TOTALDAYS: number;
  sm_ISPERPETUAL: string;
  cd_ID: number | null;
  sm_ISUSED: string;
  cd_USERNAME: string | null;
  cd_COMPANYNAME: string | null;
  cd_EMAIL: string | null;
  cd_PHONENO: string | null;
  cd_ADDRESS: string | null;
  cd_APPLICATION: string | null;
  cd_CADPRODUCTNAME: string | null;
  cd_HARDWARESERIALNO: string | null;
  cd_MACADDRESS: string | null;
  cd_PRODUCTKEY: string | null;
  cd_TRANSFER: string | null;
  cd_DATE: string | null;
  cd_VERSION: string | null;
  sddays: number;
  sm_RESETON: string | null;
  sm_IGNOREPARENT: string;
  user_STATUS: string | null;
  comments: string | null;
  upgraded_SERIALNO: string | null;
  sm_APPLICATION: string | null;
  mindate: string | null;
  maxdate: string | null;
  reseller: number | null;
  reseller_NAME: string | null;
  daysleft: number | null;
  expiryDate: string | null;
}

interface LinkedLicenseRow {
  pId: number;
  pParentId: number;
  sm_ID: number;
  cd_ID: number | null;
  name: string;
  serialKey: string;
  userName: string | null;
  companyName: string | null;
  email: string | null;
  phoneNo: string | null;
  address: string | null;
  caD_Product_Name: string | null;
  activeStatus: string;
}

interface Reseller {
  reseller_ID: number;
  reseller_Name: string;
  reseller_Location: string | null;
}

interface SubscriptionRow {
  sD_ID: number;
  sD_SM_ID: number;
  sD_DATE: string;
  sD_DAYS: number;
  sD_MODE: number;
  sD_STATUS: string;
  sD_VERSION: string;
  sD_REMARKS: string | null;
  sD_DAYSLEFTB4: number | null;
  sD_DAYSLEFTAFTER: number | null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PRODUCT_MAPPINGS: Record<string, string> = {
  '9000': 'CADdirekt BRAND',
  '6000': 'CADdirekt EL',
  '5000': 'CADdirekt VVS',
  '7000': 'CADdirekt TELE',
  '9500': 'CADdirekt BRAND LT',
  '6500': 'CADdirekt EL LT',
  '5500': 'CADdirekt VVS LT',
  '1200': 'CADdirekt SkalaFormat LT',
  '1300': 'CADdirekt SkalaFormat LT Upgrade',
  '1000': 'CADshop Svensk översättning',
  'CDBL': 'CADdirekt BRANDLARM',
  'CDBS': 'CADdirekt BRANDSKYDD',
  'SCSB': 'CADdirekt SÄKERHET',
  'CDVS': 'CADdirekt BBVVS',
  'CDEP': 'CADdirekt ELPRODUKTION',
  'CDEL': 'CADdirekt BBEL'
};

const CADDIREKT_PRODUCTS = ['9000', '6000', '5000', '7000', '9500', '6500', '5500', '1200', '1300'];
const BLUEBEAM_PRODUCTS = ['1000', 'CDBL', 'CDBS', 'SCSB', 'CDVS', 'CDEP', 'CDEL'];

export const Dashboard: React.FC<DashboardProps> = ({ session, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'customers' | 'tree' | 'resellers' | 'restore' | 'deleted'>('customers');
  
  // Search Filter States
  const [registered, setRegistered] = useState<number>(2); // 2 = Both, 1 = Registered, 0 = Unregistered
  const [upgraded, setUpgraded] = useState(false);
  const [deactivated, setDeactivated] = useState(false); // false = Active only, true = All
  const [perpetual, setPerpetual] = useState<number>(-1); // -1 = Both, 1 = Perpetual, 0 = Subscription
  const [withSmText, setWithSmText] = useState<number>(-1); // -1 = Both, 1 = With text, 0 = Without text
  const [searchText, setSearchText] = useState('');
  const [hideTrial, setHideTrial] = useState(false);
  
  // Grouped Product checkboxes
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Simplified View state
  const [simplifiedView, setSimplifiedView] = useState(false);

  // Data States
  const [customerData, setCustomerData] = useState<CustomerRow[]>([]);
  const [linkedLicenses, setLinkedLicenses] = useState<LinkedLicenseRow[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(false);
  const [treeWithTest, setTreeWithTest] = useState(false);
  
  // Latency & Stopwatch Monitor
  const [latency, setLatency] = useState<number | null>(null);
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const stopwatchIntervalRef = useRef<any>(null);

  // Detail Panel State
  const [selectedRow, setSelectedRow] = useState<CustomerRow | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [extendDays, setExtendDays] = useState(365);
  const [extendVersion, setExtendVersion] = useState('');
  const [extendRemarks, setExtendRemarks] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  
  // Inline Subscription Edit
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [editingSubDays, setEditingSubDays] = useState<number>(0);

  // Link Keys Modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkTargetSerial, setLinkTargetSerial] = useState('');
  const [linkUpdateTotalDays, setLinkUpdateTotalDays] = useState(false);
  const [linkTotalDays, setLinkTotalDays] = useState(365);
  const [linkRemarks, setLinkRemarks] = useState('');

  // Manual Upgrade section
  const [upgradeVersion, setUpgradeVersion] = useState('5.x.y');
  const [upgradePerpetual, setUpgradePerpetual] = useState(false);
  const [upgradeIgnoreParent, setUpgradeIgnoreParent] = useState(false);
  const [upgradeTotalDays, setUpgradeTotalDays] = useState(365);

  // Show Calc Popup
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [calcSummaryText, setCalcSummaryText] = useState('');
  const [loadingCalc, setLoadingCalc] = useState(false);

  // Reseller Form States
  const [newResellerName, setNewResellerName] = useState('');
  const [newResellerLocation, setNewResellerLocation] = useState('');
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);

  // Restoration Tab States
  const [restoreAppCode, setRestoreAppCode] = useState('1200');
  const [restoreVersion, setRestoreVersion] = useState('5.x.y');
  const [restoreNum, setRestoreNum] = useState(10);
  const [restoreWithTest, setRestoreWithTest] = useState(true);
  const [restoreKeysList, setRestoreKeysList] = useState<any[]>([]);
  const [selectedRestoreIds, setSelectedRestoreIds] = useState<number[]>([]);
  const [loadingRestore, setLoadingRestore] = useState(false);

  // Deleted History Tab States
  const [deletedHistoryList, setDeletedHistoryList] = useState<any[]>([]);
  const [selectedDeletedRow, setSelectedDeletedRow] = useState<any | null>(null);
  const [deletedSubscriptions, setDeletedSubscriptions] = useState<any[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);

  // Copy Emails Wizard States
  const [showEmailsModal, setShowEmailsModal] = useState(false);
  const [emailWizardProducts, setEmailWizardProducts] = useState<string[]>([]);
  const [wizardEmailsResult, setWizardEmailsResult] = useState('');
  const [loadingEmails, setLoadingEmails] = useState(false);

  // Sorting State for Table
  const [sorting, setSorting] = useState<SortingState>([]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Latency monitoring ping interval
  useEffect(() => {
    const pingHealth = async () => {
      const start = Date.now();
      try {
        const res = await fetch(`${API_BASE_URL}/api/reseller`, { headers: getAuthHeaders() });
        if (res.ok) {
          setLatency(Date.now() - start);
        } else {
          setLatency(null);
        }
      } catch {
        setLatency(null);
      }
    };

    pingHealth();
    const interval = setInterval(pingHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // Stopwatch for search requests
  useEffect(() => {
    if (loading) {
      setStopwatchSeconds(0);
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchSeconds(prev => +(prev + 0.1).toFixed(1));
      }, 100);
    } else {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
    }
    return () => {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    };
  }, [loading]);

  // Fetch Customers Search
  const handleSearch = async () => {
    setLoading(true);
    setSelectedRow(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customer/search`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          registered,
          upgraded,
          withDeactivatedLic: deactivated,
          perpetual,
          withSmText,
          products: selectedProducts.length > 0 ? selectedProducts : null,
          hideTrial,
          searchText: searchText || null
        })
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setCustomerData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Excel Export
  const handleExportExcel = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/customer/export`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          registered,
          upgraded,
          withDeactivatedLic: deactivated,
          perpetual,
          withSmText,
          products: selectedProducts.length > 0 ? selectedProducts : null,
          hideTrial,
          searchText: searchText || null
        })
      });
      if (!response.ok) throw new Error('Excel export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Customers_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Failed to export Excel file: ' + err);
    }
  };

  // Fetch Linked licenses
  const fetchLinkedTree = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/license/linked?withTest=${treeWithTest}`, {
        headers: getAuthHeaders()
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) throw new Error('Tree load failed');
      const data = await response.json();
      setLinkedLicenses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Resellers list
  const fetchResellers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/reseller`, {
        headers: getAuthHeaders()
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setResellers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load customer details, comments, and subscriptions
  const loadRowDetails = async (row: CustomerRow) => {
    setSelectedRow(row);
    setNewComment('');
    setExtendVersion(row.cd_VERSION || '');
    setExtendRemarks('');
    setEditingSubId(null);
    
    if (row.cd_ID) {
      // Fetch Comments
      try {
        const res = await fetch(`${API_BASE_URL}/api/customer/${row.cd_ID}/comments`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setComments(data);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      setComments([]);
    }

    // Fetch Subscriptions
    try {
      const res = await fetch(`${API_BASE_URL}/api/license/subscriptions?serialNo=${row.sm_SERIALNO}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Prev / Next Traversal
  const handlePrevRow = () => {
    if (!selectedRow) return;
    const rows = table.getRowModel().rows;
    const index = rows.findIndex(r => r.original.sm_SERIALNO === selectedRow.sm_SERIALNO);
    if (index > 0) {
      loadRowDetails(rows[index - 1].original);
    }
  };

  const handleNextRow = () => {
    if (!selectedRow) return;
    const rows = table.getRowModel().rows;
    const index = rows.findIndex(r => r.original.sm_SERIALNO === selectedRow.sm_SERIALNO);
    if (index < rows.length - 1) {
      loadRowDetails(rows[index + 1].original);
    }
  };

  // Add Comment Action
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedRow || !selectedRow.cd_ID) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/customer/comments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          customerDetailId: selectedRow.cd_ID,
          commentText: newComment
        })
      });
      if (res.ok) {
        setNewComment('');
        loadRowDetails(selectedRow);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Extend License Action
  const handleExtendLicense = async (e: React.FormEvent, isOffline: boolean) => {
    e.preventDefault();
    if (!selectedRow) return;
    setSubmittingAction(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/license/extend`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          serialNo: selectedRow.sm_SERIALNO,
          days: extendDays,
          mode: isOffline ? 1 : 0,
          status: 'Active',
          version: extendVersion,
          remarks: extendRemarks
        })
      });

      if (res.ok) {
        if (isOffline) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${selectedRow.sm_SERIALNO}.lic`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          alert('Offline license file compiled and downloaded successfully!');
        } else {
          alert('License successfully extended!');
        }
        loadRowDetails(selectedRow);
        handleSearch();
      } else {
        const errData = await res.json();
        alert('Error: ' + errData.message);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to extend license.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Toggle Activation
  const handleToggleActivation = async () => {
    if (!selectedRow) return;
    setSubmittingAction(true);
    const action = selectedRow.sm_ISACTIVE === 'Active' ? 'deactivate' : 'activate';

    try {
      const res = await fetch(`${API_BASE_URL}/api/license/${action}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ serialNo: selectedRow.sm_SERIALNO })
      });
      if (res.ok) {
        const updatedRow = { ...selectedRow, sm_ISACTIVE: action === 'deactivate' ? 'DeActivated' : 'Active' };
        setSelectedRow(updatedRow);
        handleSearch();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Reset Used Machine status
  const handleResetUsed = async () => {
    if (!selectedRow) return;
    if (!confirm('Are you sure you want to reset the machine utilization status for this license?')) return;
    setSubmittingAction(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/license/reset-used`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ serialNo: selectedRow.sm_SERIALNO })
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        loadRowDetails({ ...selectedRow, sm_ISUSED: 'NotUsed' });
        handleSearch();
      } else {
        const err = await res.json();
        alert('Reset failed: ' + err.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Save key comments remarks (`SM_TEXT`)
  const handleSaveRemarks = async (remarks: string) => {
    if (!selectedRow) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/license/update-text`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ serialNo: selectedRow.sm_SERIALNO, text: remarks })
      });
      if (res.ok) {
        setSelectedRow({ ...selectedRow, sm_TEXT: remarks });
        handleSearch();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Save Inline subscription modification
  const handleSaveSubInline = async (subId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/license/subscriptions/${subId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ days: editingSubDays })
      });
      if (res.ok) {
        setEditingSubId(null);
        if (selectedRow) loadRowDetails(selectedRow);
        handleSearch();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete subscription
  const handleDeleteSub = async (subId: number) => {
    if (!confirm('Are you sure you want to delete this subscription history entry?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/license/subscriptions/${subId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        if (selectedRow) loadRowDetails(selectedRow);
        handleSearch();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load Calc breakdowns report
  const handleShowCalc = async () => {
    if (!selectedRow) return;
    setLoadingCalc(true);
    setShowCalcModal(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/license/${selectedRow.sm_SERIALNO}/calc`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCalcSummaryText(data.summaryText);
      } else {
        setCalcSummaryText('Failed to calculate days left breakdown.');
      }
    } catch (err) {
      console.error(err);
      setCalcSummaryText('Failed to load calculation.');
    } finally {
      setLoadingCalc(false);
    }
  };

  // Link Parent-Child Keys
  const handleLinkKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRow || !linkTargetSerial.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/license/link`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          sourceSerial: selectedRow.sm_SERIALNO,
          targetSerial: linkTargetSerial,
          updateTotalDays: linkUpdateTotalDays,
          totalDays: linkTotalDays,
          remarks: linkRemarks
        })
      });

      if (res.ok) {
        alert('Keys successfully linked!');
        setShowLinkModal(false);
        setLinkTargetSerial('');
        setLinkRemarks('');
        loadRowDetails(selectedRow);
        handleSearch();
      } else {
        const err = await res.json();
        alert('Linking failed: ' + err.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manual Version Upgrade
  const handlePerformUpgrade = async () => {
    if (!selectedRow) return;
    if (!confirm(`Upgrade serial key ${selectedRow.sm_SERIALNO} to version ${upgradeVersion}?`)) return;
    setSubmittingAction(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/license/upgrade`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          sourceSerial: selectedRow.sm_SERIALNO,
          targetVersion: upgradeVersion,
          isPerpetual: upgradePerpetual,
          ignoreParent: upgradeIgnoreParent,
          totalDays: upgradeTotalDays
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Upgrade successful!\nNew Assigned Key: ${data.upgradedSerial}`);
        loadRowDetails(selectedRow);
        handleSearch();
      } else {
        const err = await res.json();
        alert('Upgrade failed: ' + err.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Assign Reseller to selected Customer Key
  const handleAssignReseller = async (resellerId: number) => {
    if (!selectedRow) return;
    setSubmittingAction(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/reseller/assign`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          resellerId,
          serialNo: selectedRow.sm_SERIALNO
        })
      });
      if (res.ok) {
        const selectedReseller = resellers.find(r => r.reseller_ID === resellerId);
        const updatedRow = { 
          ...selectedRow, 
          reseller: resellerId,
          reseller_NAME: selectedReseller ? selectedReseller.reseller_Name : '' 
        };
        setSelectedRow(updatedRow);
        handleSearch();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Create or Update Reseller
  const handleSaveReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResellerName.trim()) return;

    try {
      const url = editingReseller 
        ? `${API_BASE_URL}/api/reseller/${editingReseller.reseller_ID}`
        : `${API_BASE_URL}/api/reseller`;
        
      const response = await fetch(url, {
        method: editingReseller ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          reseller_Name: newResellerName,
          reseller_Location: newResellerLocation
        })
      });

      if (response.ok) {
        setNewResellerName('');
        setNewResellerLocation('');
        setEditingReseller(null);
        fetchResellers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Reseller
  const handleDeleteReseller = async (id: number) => {
    if (!confirm('Are you sure you want to delete this reseller?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/reseller/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        fetchResellers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Restoration Tab Loader
  const handleLoadRestoreKeys = async () => {
    setLoadingRestore(true);
    setSelectedRestoreIds([]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/license/restore?appCode=${restoreAppCode}&version=${restoreVersion}&num=${restoreNum}&withTest=${restoreWithTest}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setRestoreKeysList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRestore(false);
    }
  };

  // Restore Action
  const handleRestoreKeys = async () => {
    if (selectedRestoreIds.length === 0) return;
    if (!confirm(`Are you sure you want to restore these ${selectedRestoreIds.length} selected license keys?`)) return;
    setLoadingRestore(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/license/restore`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids: selectedRestoreIds })
      });
      if (res.ok) {
        alert('Selected backup keys successfully restored!');
        handleLoadRestoreKeys();
        if (activeTab === 'customers') handleSearch();
      } else {
        const err = await res.json();
        alert('Restore failed: ' + err.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRestore(false);
    }
  };

  // Deleted History Tab Loader
  const handleLoadDeletedHistory = async () => {
    setLoadingDeleted(true);
    setSelectedDeletedRow(null);
    setDeletedSubscriptions([]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/license/deleted`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDeletedHistoryList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDeleted(false);
    }
  };

  // Load Deleted Subscriptions details
  const handleLoadDeletedSubscriptions = async (row: any) => {
    setSelectedDeletedRow(row);
    try {
      const res = await fetch(`${API_BASE_URL}/api/license/deleted/${row.sM_SERIALNO}/subscriptions`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDeletedSubscriptions(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Unique Emails Wizard Aggregation
  const handleGenerateAggregation = async () => {
    if (emailWizardProducts.length === 0) return;
    setLoadingEmails(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/customer/emails`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailWizardProducts)
      });
      if (res.ok) {
        const data = await res.json();
        setWizardEmailsResult(data.emailsText);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEmails(false);
    }
  };

  // Copy wizard generated emails to clipboard
  const handleCopyEmailsToClipboard = () => {
    if (!wizardEmailsResult) return;
    navigator.clipboard.writeText(wizardEmailsResult);
    alert('Aggregated email list copied to clipboard!');
  };

  // Reset all layout filters
  const handleResetLayoutSettings = () => {
    setRegistered(2);
    setUpgraded(false);
    setDeactivated(false);
    setPerpetual(-1);
    setWithSmText(-1);
    setSearchText('');
    setHideTrial(false);
    setSelectedProducts([]);
    setSimplifiedView(false);
    alert('Search and grid layout filters have been reset to defaults.');
  };

  useEffect(() => {
    fetchResellers();
  }, []);

  useEffect(() => {
    if (activeTab === 'customers') {
      handleSearch();
    } else if (activeTab === 'tree') {
      fetchLinkedTree();
    } else if (activeTab === 'resellers') {
      fetchResellers();
    } else if (activeTab === 'restore') {
      handleLoadRestoreKeys();
    } else if (activeTab === 'deleted') {
      handleLoadDeletedHistory();
    }
  }, [activeTab, treeWithTest]);

  // Table Columns Definition
  const columnHelper = createColumnHelper<CustomerRow>();
  const columns = useMemo(() => {
    const allCols = [
      columnHelper.accessor('sm_SERIALNO', {
        header: 'Serial Key',
        cell: info => <span className="font-semibold" style={{ color: 'var(--accent-blue)' }}>{info.getValue()}</span>
      }),
      columnHelper.accessor('sm_ISACTIVE', {
        header: 'Status',
        cell: info => {
          const status = info.getValue();
          return (
            <span className={`badge ${status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
              {status}
            </span>
          );
        }
      }),
      columnHelper.accessor('cd_USERNAME', {
        header: 'User Name',
        cell: info => info.getValue() || <span className="text-muted">-</span>
      }),
      columnHelper.accessor('cd_COMPANYNAME', {
        header: 'Company',
        cell: info => info.getValue() || <span className="text-muted">-</span>
      }),
      columnHelper.accessor('cd_EMAIL', {
        header: 'Email',
        cell: info => info.getValue() || <span className="text-muted">-</span>
      }),
      columnHelper.accessor('cd_APPLICATION', {
        header: 'Product Module',
        cell: info => {
          const val = info.getValue() || '';
          return PRODUCT_MAPPINGS[val] || val || <span className="text-muted">-</span>;
        }
      }),
      columnHelper.accessor('cd_VERSION', {
        header: 'Version',
        cell: info => info.getValue() || <span className="text-muted">-</span>
      }),
      columnHelper.accessor('daysleft', {
        header: 'Days Left',
        cell: info => {
          const val = info.getValue();
          if (val === null) return <span className="text-muted">-</span>;
          return (
            <span className={val <= 30 ? 'text-rose-500 font-bold' : ''}>
              {val}
            </span>
          );
        }
      }),
      columnHelper.accessor('expiryDate', {
        header: 'Expiry Date',
        cell: info => {
          const val = info.getValue();
          return val ? new Date(val).toLocaleDateString() : <span className="text-muted">-</span>;
        }
      }),
      columnHelper.accessor('reseller_NAME', {
        header: 'Reseller',
        cell: info => info.getValue() || <span className="text-muted">-</span>
      })
    ];

    if (simplifiedView) {
      return allCols.filter(col => {
        const id = col.id || (col as any).accessorKey;
        return !['cd_EMAIL', 'cd_VERSION', 'expiryDate', 'reseller_NAME'].includes(id);
      });
    }
    return allCols;
  }, [simplifiedView, resellers]);

  // Table Instance Setup
  const table = useReactTable({
    data: customerData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Calculate stats
  const stats = useMemo(() => {
    const total = customerData.length;
    const active = customerData.filter(r => r.sm_ISACTIVE === 'Active').length;
    const deactivated = total - active;
    const expiringSoon = customerData.filter(r => r.daysleft !== null && r.daysleft >= 0 && r.daysleft <= 30).length;

    return { total, active, deactivated, expiringSoon };
  }, [customerData]);

  // Nested License Tree View
  const treeNodes = useMemo(() => {
    const nodeMap: Record<number, LinkedLicenseRow & { children: any[] }> = {};
    const rootNodes: any[] = [];

    linkedLicenses.forEach(row => {
      nodeMap[row.pId] = { ...row, children: [] };
    });

    linkedLicenses.forEach(row => {
      const node = nodeMap[row.pId];
      if (row.pParentId === 0 || !nodeMap[row.pParentId]) {
        rootNodes.push(node);
      } else {
        nodeMap[row.pParentId].children.push(node);
      }
    });

    return rootNodes;
  }, [linkedLicenses]);

  const renderTreeNode = (node: any) => {
    return (
      <div key={node.pId} style={{ marginLeft: '1.5rem', borderLeft: '1px dashed var(--border-color)', paddingLeft: '1rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
        <div className="flex items-center gap-2" style={{ padding: '0.4rem 0' }}>
          <ChevronRight size={16} className="text-muted" />
          <span className="font-semibold text-slate-800">{node.name}</span>
          <span className={`badge ${node.activeStatus === 'Active' ? 'badge-active' : 'badge-inactive'}`} style={{ fontSize: '0.65rem' }}>
            {node.activeStatus}
          </span>
          {node.companyName && <span className="text-muted" style={{ fontSize: '0.8rem' }}>({node.companyName})</span>}
          {node.caD_Product_Name && <span className="badge" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-blue)', fontSize: '0.65rem' }}>{node.caD_Product_Name}</span>}
        </div>
        {node.children.map((child: any) => renderTreeNode(child))}
      </div>
    );
  };

  const handleToggleProductChecked = (code: string) => {
    setSelectedProducts(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const selectAllGroup = (group: 'caddirekt' | 'bluebeam') => {
    const products = group === 'caddirekt' ? CADDIREKT_PRODUCTS : BLUEBEAM_PRODUCTS;
    setSelectedProducts(prev => {
      const filtered = prev.filter(c => !products.includes(c));
      return [...filtered, ...products];
    });
  };

  const clearAllGroup = (group: 'caddirekt' | 'bluebeam') => {
    const products = group === 'caddirekt' ? CADDIREKT_PRODUCTS : BLUEBEAM_PRODUCTS;
    setSelectedProducts(prev => prev.filter(c => !products.includes(c)));
  };

  const restoreProductsList = useMemo(() => {
    const filterList = session.isPatrikUser ? PRODUCT_MAPPINGS : {
      '1200': 'CADdirekt SkalaFormat LT',
      '1300': 'CADdirekt SkalaFormat LT Upgrade'
    };
    return Object.entries(filterList);
  }, [session]);

  return (
    <div className="layout-container">
      {/* Sidebar Navigation */}
      <aside style={{
        backgroundColor: '#ffffff',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1.25rem'
      }}>
        <div>
          <div className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'var(--accent-blue)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800
            }}>CD</div>
            <div>
              <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--accent-blue)' }}>CADdirekt</h3>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Admin console</p>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <button
              onClick={() => setActiveTab('customers')}
              className="flex items-center gap-3 w-full"
              style={{
                background: activeTab === 'customers' ? 'var(--accent-light)' : 'transparent',
                color: activeTab === 'customers' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: 'none',
                padding: '0.65rem 0.8rem',
                borderRadius: '8px',
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <Users size={16} />
              Customer Grid
            </button>

            <button
              onClick={() => setActiveTab('tree')}
              className="flex items-center gap-3 w-full"
              style={{
                background: activeTab === 'tree' ? 'var(--accent-light)' : 'transparent',
                color: activeTab === 'tree' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: 'none',
                padding: '0.65rem 0.8rem',
                borderRadius: '8px',
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <Link2 size={16} />
              Linked Keys Tree
            </button>

            <button
              onClick={() => setActiveTab('resellers')}
              className="flex items-center gap-3 w-full"
              style={{
                background: activeTab === 'resellers' ? 'var(--accent-light)' : 'transparent',
                color: activeTab === 'resellers' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: 'none',
                padding: '0.65rem 0.8rem',
                borderRadius: '8px',
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <Building2 size={16} />
              Resellers List
            </button>

            <button
              onClick={() => setActiveTab('restore')}
              className="flex items-center gap-3 w-full"
              style={{
                background: activeTab === 'restore' ? 'var(--accent-light)' : 'transparent',
                color: activeTab === 'restore' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: 'none',
                padding: '0.65rem 0.8rem',
                borderRadius: '8px',
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <Key size={16} />
              Restore Keys
            </button>

            <button
              onClick={() => setActiveTab('deleted')}
              className="flex items-center gap-3 w-full"
              style={{
                background: activeTab === 'deleted' ? 'var(--accent-light)' : 'transparent',
                color: activeTab === 'deleted' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: 'none',
                padding: '0.65rem 0.8rem',
                borderRadius: '8px',
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <History size={16} />
              Reset History
            </button>
          </nav>
        </div>

        <div>
          {/* Health connection latency */}
          <div className="flex items-center gap-2" style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f1f5f9', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.75rem' }}>
            <Activity size={14} className={latency !== null ? 'text-emerald-500' : 'text-rose-500'} />
            <span style={{ fontWeight: 600 }}>
              {latency !== null ? `DB Ping: ${latency}ms` : 'DB Offline'}
            </span>
          </div>

          <div style={{ padding: '0.75rem 0', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
            <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{session.username}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
              {session.isPatrikUser ? 'Super Admin' : 'Admin'}
            </p>
          </div>
          <button
            onClick={() => {
              removeSession();
              onLogout();
            }}
            className="flex items-center gap-3 w-full btn-secondary"
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              justifyContent: 'center',
              fontSize: '0.85rem'
            }}
          >
            <LogOut size={14} />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Workspace Column */}
      <main className="main-content flex-col" style={{ display: 'flex', position: 'relative' }}>
        {/* Stopwatch Loading Overlay */}
        {loading && (
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            color: '#ffffff',
            padding: '0.4rem 0.8rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'pulse 1.5s infinite'
            }} />
            Search Processing: {stopwatchSeconds}s
          </div>
        )}

        {activeTab === 'customers' && (
          <>
            {/* Page Header */}
            <header className="flex items-center justify-between" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h2>Customer License Matrix</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Query, activate, and extend customer software modules</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowEmailsModal(true)} className="btn-secondary flex items-center gap-1" style={{ fontSize: '0.85rem' }}>
                  <Clipboard size={16} />
                  Copy Emails
                </button>
                <button onClick={handleExportExcel} className="btn-primary flex items-center gap-1" style={{ fontSize: '0.85rem' }}>
                  Export Excel
                </button>
              </div>
            </header>

            {/* Filters Dashboard Grid */}
            <section className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="grid" style={{
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem' }}>Registration Status</label>
                  <select className="form-input" value={registered} onChange={e => setRegistered(Number(e.target.value))}>
                    <option value={2}>Both</option>
                    <option value={1}>Registered Only</option>
                    <option value={0}>Unregistered Only</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem' }}>Active Status</label>
                  <label className="flex items-center gap-1 cursor-pointer" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    <input type="checkbox" checked={deactivated} onChange={e => setDeactivated(e.target.checked)} />
                    Include Deactivated
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem' }}>License Model</label>
                  <select className="form-input" value={perpetual} onChange={e => setPerpetual(Number(e.target.value))}>
                    <option value={-1}>All Types</option>
                    <option value={1}>Perpetual</option>
                    <option value={0}>Subscription</option>
                  </select>
                </div>

                {/* Grouped Checked Product List Dropdown */}
                <div style={{ position: 'relative' }} ref={dropdownRef}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem' }}>Product Filter</label>
                  <button 
                    type="button" 
                    className="form-input flex justify-between items-center text-left" 
                    onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                    style={{ fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    <span>
                      {selectedProducts.length === 0 
                        ? 'All Products' 
                        : `${selectedProducts.length} Selected`}
                    </span>
                    <ChevronDown size={14} />
                  </button>

                  {productDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      boxShadow: 'var(--shadow-premium)',
                      zIndex: 200,
                      maxHeight: '300px',
                      overflowY: 'auto',
                      padding: '0.75rem'
                    }}>
                      {/* CADdirekt Group */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div className="flex justify-between items-center" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-blue)' }}>CADdirekt Products</span>
                          <div className="flex gap-2" style={{ fontSize: '0.65rem' }}>
                            <button type="button" onClick={() => selectAllGroup('caddirekt')} className="text-blue-500 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>All</button>
                            <button type="button" onClick={() => clearAllGroup('caddirekt')} className="text-gray-500 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          {CADDIREKT_PRODUCTS.map(code => (
                            <label key={code} className="flex items-center gap-2" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={selectedProducts.includes(code)} 
                                onChange={() => handleToggleProductChecked(code)} 
                              />
                              {PRODUCT_MAPPINGS[code] || code}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Bluebeam Group */}
                      <div>
                        <div className="flex justify-between items-center" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-blue)' }}>Bluebeam / Add-on</span>
                          <div className="flex gap-2" style={{ fontSize: '0.65rem' }}>
                            <button type="button" onClick={() => selectAllGroup('bluebeam')} className="text-blue-500 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>All</button>
                            <button type="button" onClick={() => clearAllGroup('bluebeam')} className="text-gray-500 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          {BLUEBEAM_PRODUCTS.map(code => (
                            <label key={code} className="flex items-center gap-2" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={selectedProducts.includes(code)} 
                                onChange={() => handleToggleProductChecked(code)} 
                              />
                              {PRODUCT_MAPPINGS[code] || code}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem' }}>Text Search</label>
                  <div className="flex items-center" style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      placeholder="Search key, name, email..."
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <Search size={14} style={{ position: 'absolute', right: '0.75rem', color: 'var(--text-muted)' }} />
                  </div>
                </div>
              </div>

              {/* Extra Layout Filters */}
              <div className="flex justify-between items-center" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', fontSize: '0.85rem' }}>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1 cursor-pointer font-semibold">
                    <input type="checkbox" checked={simplifiedView} onChange={e => setSimplifiedView(e.target.checked)} />
                    Simplified View
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer font-semibold">
                    <input type="checkbox" checked={hideTrial} onChange={e => setHideTrial(e.target.checked)} />
                    Hide Trial Keys
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer font-semibold">
                    <input type="checkbox" checked={upgraded} onChange={e => setUpgraded(e.target.checked)} />
                    Upgraded Chains Only
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleResetLayoutSettings} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                    Reset Filters
                  </button>
                  <button onClick={handleSearch} className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}>
                    Apply Search
                  </button>
                </div>
              </div>
            </section>

            {/* Performance Stats */}
            <section className="grid" style={{
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1rem',
              marginBottom: '1.25rem'
            }}>
              <div className="card flex items-center gap-4" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-blue)', padding: '0.4rem', borderRadius: '6px' }}>
                  <Key size={16} />
                </div>
                <div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Keys Matched</p>
                  <h4 style={{ margin: 0 }}>{stats.total}</h4>
                </div>
              </div>
              <div className="card flex items-center gap-4" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-active)', padding: '0.4rem', borderRadius: '6px' }}>
                  <CheckCircle size={16} />
                </div>
                <div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Active</p>
                  <h4 style={{ margin: 0 }}>{stats.active}</h4>
                </div>
              </div>
              <div className="card flex items-center gap-4" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-inactive)', padding: '0.4rem', borderRadius: '6px' }}>
                  <XCircle size={16} />
                </div>
                <div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Deactivated</p>
                  <h4 style={{ margin: 0 }}>{stats.deactivated}</h4>
                </div>
              </div>
              <div className="card flex items-center gap-4" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-warning)', padding: '0.4rem', borderRadius: '6px' }}>
                  <Clock size={16} />
                </div>
                <div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Expiring Soon (≤30d)</p>
                  <h4 style={{ margin: 0 }}>{stats.expiringSoon}</h4>
                </div>
              </div>
            </section>

            {/* Split Workspace */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: selectedRow ? '3fr 2fr' : '1fr',
              gap: '1.25rem',
              alignItems: 'start',
              flex: 1
            }}>
              <div className="table-container" style={{ margin: 0 }}>
                <table className="data-table">
                  <thead>
                    {table.getHeaderGroups().map(headerGroup => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map(header => (
                          <th key={header.id} onClick={header.column.getToggleSortingHandler()} style={{ cursor: 'pointer' }}>
                            <div className="flex items-center gap-1">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {{
                                asc: ' 🔼',
                                desc: ' 🔽',
                              }[header.column.getIsSorted() as string] ?? null}
                            </div>
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={columns.length} style={{ textAlign: 'center', padding: '3rem' }}>
                          Loading license data...
                        </td>
                      </tr>
                    ) : customerData.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} style={{ textAlign: 'center', padding: '3rem' }}>
                          No keys matched the filter parameters.
                        </td>
                      </tr>
                    ) : (
                      table.getRowModel().rows.map(row => (
                        <tr
                          key={row.id}
                          onClick={() => loadRowDetails(row.original)}
                          style={{
                            cursor: 'pointer',
                            backgroundColor: selectedRow?.sm_ID === row.original.sm_ID ? 'rgba(6, 115, 186, 0.08)' : 'transparent',
                            borderLeft: selectedRow?.sm_ID === row.original.sm_ID ? '4px solid var(--accent-blue)' : 'none'
                          }}
                        >
                          {row.getVisibleCells().map(cell => (
                            <td key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Selected Customer Details */}
              {selectedRow && (
                <div className="card flex-col" style={{ display: 'flex', gap: '1.25rem', position: 'sticky', top: '10px', maxHeight: '85vh', overflowY: 'auto' }}>
                  <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <div>
                      <h4 style={{ margin: 0 }}>License details</h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{selectedRow.sm_SERIALNO}</p>
                    </div>
                    {/* Prev / Next traversal */}
                    <div className="flex gap-1">
                      <button onClick={handlePrevRow} className="btn-secondary" style={{ padding: '0.2rem 0.4rem' }}>
                        <ArrowLeft size={14} />
                      </button>
                      <button onClick={handleNextRow} className="btn-secondary" style={{ padding: '0.2rem 0.4rem' }}>
                        <ArrowRight size={14} />
                      </button>
                      <button onClick={() => setSelectedRow(null)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', color: '#f43f5e' }}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Customer Contact */}
                  <div style={{ fontSize: '0.8rem' }}>
                    <h5 style={{ fontSize: '0.85rem', marginBottom: '0.3rem', borderLeft: '3px solid var(--accent-blue)', paddingLeft: '0.4rem' }}>Contact Info</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <p><strong>User:</strong> {selectedRow.cd_USERNAME || '-'}</p>
                      <p><strong>Company:</strong> {selectedRow.cd_COMPANYNAME || '-'}</p>
                      <p><strong>Email:</strong> {selectedRow.cd_EMAIL || '-'}</p>
                      <p><strong>Phone:</strong> {selectedRow.cd_PHONENO || '-'}</p>
                    </div>
                  </div>

                  {/* Hardware */}
                  <div style={{ fontSize: '0.8rem' }}>
                    <h5 style={{ fontSize: '0.85rem', marginBottom: '0.3rem', borderLeft: '3px solid var(--accent-blue)', paddingLeft: '0.4rem' }}>Hardware</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <p><strong>MAC:</strong> {selectedRow.cd_MACADDRESS || '-'}</p>
                      <p><strong>HW Serial:</strong> {selectedRow.cd_HARDWARESERIALNO || '-'}</p>
                      <p><strong>Product Key:</strong> {selectedRow.cd_PRODUCTKEY || '-'}</p>
                      <p><strong>Is Used:</strong> {selectedRow.sm_ISUSED}</p>
                    </div>
                  </div>

                  {/* Remarks & Save */}
                  <div>
                    <h5 style={{ fontSize: '0.85rem', marginBottom: '0.3rem', borderLeft: '3px solid var(--accent-blue)', paddingLeft: '0.4rem' }}>Remarks</h5>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="form-input" 
                        defaultValue={selectedRow.sm_TEXT || ''} 
                        onBlur={(e) => handleSaveRemarks(e.target.value)}
                        placeholder="Add Remarks (SM_TEXT)"
                        style={{ fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>

                  {/* Operations Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button onClick={handleShowCalc} className="btn-secondary" style={{ padding: '0.4rem', fontSize: '0.8rem', justifyContent: 'center', display: 'flex', alignItems: 'center' }}>
                      Show Calc
                    </button>
                    <button onClick={() => setShowLinkModal(true)} className="btn-secondary" style={{ padding: '0.4rem', fontSize: '0.8rem', justifyContent: 'center', display: 'flex', alignItems: 'center' }}>
                      Link Keys
                    </button>
                    <button onClick={handleResetUsed} className="btn-secondary" style={{ padding: '0.4rem', fontSize: '0.8rem', justifyContent: 'center', display: 'flex', alignItems: 'center', gridColumn: 'span 2' }}>
                      Reset Machine (Used Status)
                    </button>
                  </div>

                  {/* Reseller Assignment */}
                  <div>
                    <h5 style={{ fontSize: '0.85rem', marginBottom: '0.3rem', borderLeft: '3px solid var(--accent-blue)', paddingLeft: '0.4rem' }}>Distributor / Reseller</h5>
                    <select 
                      className="form-input" 
                      value={selectedRow.reseller || ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) handleAssignReseller(Number(val));
                      }}
                      disabled={submittingAction}
                      style={{ fontSize: '0.8rem' }}
                    >
                      <option value="">No Reseller Assigned</option>
                      {resellers.map(r => (
                        <option key={r.reseller_ID} value={r.reseller_ID}>{r.reseller_Name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Toggle Activation */}
                  <div className="flex gap-4">
                    <button 
                      onClick={handleToggleActivation} 
                      className={`btn-secondary flex-1`}
                      style={{ 
                        padding: '0.5rem',
                        fontSize: '0.8rem',
                        color: selectedRow.sm_ISACTIVE === 'Active' ? 'var(--status-inactive)' : 'var(--status-active)',
                        borderColor: selectedRow.sm_ISACTIVE === 'Active' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                      }}
                      disabled={submittingAction}
                    >
                      {selectedRow.sm_ISACTIVE === 'Active' ? 'Deactivate Key' : 'Activate Key'}
                    </button>
                  </div>

                  {/* Manual Version Upgrade */}
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem', backgroundColor: '#f8fafc' }}>
                    <h5 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Manual Version Upgrade</h5>
                    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600 }}>Target Version</label>
                        <select className="form-input" value={upgradeVersion} onChange={e => setUpgradeVersion(e.target.value)} style={{ padding: '0.3rem', fontSize: '0.8rem' }}>
                          <option value="2.x.y">2.x.y</option>
                          <option value="3.x.y">3.x.y</option>
                          <option value="4.x.y">4.x.y</option>
                          <option value="5.x.y">5.x.y</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600 }}>Total Days</label>
                        <input type="number" className="form-input" value={upgradeTotalDays} onChange={e => setUpgradeTotalDays(Number(e.target.value))} style={{ padding: '0.3rem', fontSize: '0.8rem' }} />
                      </div>
                    </div>
                    <div className="flex gap-4" style={{ marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={upgradePerpetual} onChange={e => setUpgradePerpetual(e.target.checked)} />
                        Perpetual
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={upgradeIgnoreParent} onChange={e => setUpgradeIgnoreParent(e.target.checked)} />
                        Ignore Parent
                      </label>
                    </div>
                    <button type="button" onClick={handlePerformUpgrade} className="btn-primary w-full" style={{ padding: '0.4rem', fontSize: '0.8rem', justifyContent: 'center' }}>
                      Perform Upgrade
                    </button>
                  </div>

                  {/* Extend Subscription */}
                  <form style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-primary)'
                  }}>
                    <h5 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Extend License (Add Days)</h5>
                    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600 }}>Days</label>
                        <select className="form-input" value={extendDays} onChange={e => setExtendDays(Number(e.target.value))} style={{ padding: '0.3rem', fontSize: '0.8rem' }}>
                          <option value={365}>1 Year (365 Days)</option>
                          <option value={30}>1 Month (30 Days)</option>
                          <option value={90}>3 Months (90 Days)</option>
                          <option value={730}>2 Years (730 Days)</option>
                          <option value={0}>0 Days (Update Info)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600 }}>Version</label>
                        <input
                          type="text"
                          className="form-input"
                          value={extendVersion}
                          onChange={e => setExtendVersion(e.target.value)}
                          placeholder="e.g. 5.1.0"
                          style={{ padding: '0.3rem', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 600 }}>Remarks</label>
                      <input
                        type="text"
                        className="form-input"
                        value={extendRemarks}
                        onChange={e => setExtendRemarks(e.target.value)}
                        placeholder="Remarks..."
                        style={{ padding: '0.3rem', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={(e) => handleExtendLicense(e, false)} className="btn-primary flex-1" style={{ padding: '0.4rem', fontSize: '0.8rem', justifyContent: 'center' }} disabled={submittingAction}>
                        Online Extend
                      </button>
                      <button type="button" onClick={(e) => handleExtendLicense(e, true)} className="btn-secondary flex-1" style={{ padding: '0.4rem', fontSize: '0.8rem', justifyContent: 'center' }} disabled={submittingAction}>
                        Offline File
                      </button>
                    </div>
                  </form>

                  {/* Subscriptions Grid with Edit/Delete */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <h5 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }} className="flex items-center gap-1">
                      <Clock size={14} />
                      Subscription Details
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {subscriptions.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>No subscription history.</p>
                      ) : (
                        subscriptions.map((sub) => (
                          <div key={sub.sD_ID} style={{
                            backgroundColor: '#ffffff',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.2rem'
                          }}>
                            <div className="flex justify-between items-center">
                              {editingSubId === sub.sD_ID ? (
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    className="form-input" 
                                    value={editingSubDays} 
                                    onChange={e => setEditingSubDays(Number(e.target.value))} 
                                    style={{ width: '60px', padding: '0.1rem 0.2rem', fontSize: '0.75rem' }} 
                                  />
                                  <span>days</span>
                                </div>
                              ) : (
                                <span className="font-semibold text-slate-800">+{sub.sD_DAYS} Days ({sub.sD_VERSION})</span>
                              )}

                              <div className="flex gap-2">
                                {editingSubId === sub.sD_ID ? (
                                  <>
                                    <button onClick={() => handleSaveSubInline(sub.sD_ID)} className="text-emerald-500 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                                    <button onClick={() => setEditingSubId(null)} className="text-gray-500 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => {
                                      setEditingSubId(sub.sD_ID);
                                      setEditingSubDays(sub.sD_DAYS);
                                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                      <Edit size={12} />
                                    </button>
                                    <button onClick={() => handleDeleteSub(sub.sD_ID)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between text-muted" style={{ fontSize: '0.65rem' }}>
                              <span>Mode: {sub.sD_MODE === 0 ? 'Online' : 'Offline'}</span>
                              <span>Added: {sub.sD_DATE ? new Date(sub.sD_DATE).toLocaleDateString() : ''}</span>
                            </div>
                            {sub.sD_REMARKS && <span className="text-muted" style={{ fontSize: '0.65rem', fontStyle: 'italic' }}>Remarks: {sub.sD_REMARKS}</span>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Comments Section */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <h5 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }} className="flex items-center gap-1">
                      <MessageSquare size={14} />
                      Admin Comments
                    </h5>
                    <form onSubmit={handleAddComment} className="flex gap-1" style={{ marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Add comment..."
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        disabled={!selectedRow.cd_ID}
                        style={{ padding: '0.3rem', fontSize: '0.8rem' }}
                      />
                      <button type="submit" className="btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} disabled={!selectedRow.cd_ID}>Add</button>
                    </form>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {comments.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>No comments found.</p>
                      ) : (
                        comments.map((c: any) => (
                          <div key={c.Comment_ID || c.commentMessage} style={{
                            backgroundColor: '#ffffff',
                            padding: '0.4rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.75rem'
                          }}>
                            {c.commentMessage}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'tree' && (
          <>
            <header className="flex items-center justify-between" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h2>Linked Serial Keys</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Visualizing hierarchy and seat linking relationships</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer card" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={treeWithTest} onChange={e => setTreeWithTest(e.target.checked)} />
                Include Test Keys
              </label>
            </header>

            <div className="card" style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <p style={{ textAlign: 'center', padding: '3rem' }}>Loading hierarchical tree...</p>
              ) : treeNodes.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '3rem' }}>No linked serial keys found.</p>
              ) : (
                <div style={{ padding: '0.5rem 0' }}>
                  {treeNodes.map(node => (
                    <div key={node.pId} style={{ marginBottom: '1.25rem' }}>
                      <div className="flex items-center gap-2 font-bold" style={{ fontSize: '0.95rem', color: 'var(--text-primary)', padding: '0.3rem 0' }}>
                        <ChevronRight size={16} style={{ color: 'var(--accent-blue)' }} />
                        <span>{node.name}</span>
                        <span className={`badge ${node.activeStatus === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                          {node.activeStatus}
                        </span>
                        {node.companyName && <span className="text-secondary" style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>— {node.companyName}</span>}
                        {node.caD_Product_Name && <span className="badge" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-blue)', fontSize: '0.65rem' }}>{node.caD_Product_Name}</span>}
                      </div>
                      {node.children.map((child: any) => renderTreeNode(child))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'resellers' && (
          <>
            <header className="flex items-center justify-between" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h2>Reseller Directory</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Manage distributor networks and sales locations</p>
              </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem', alignItems: 'start' }}>
              {/* Reseller Form Card */}
              <form onSubmit={handleSaveReseller} className="card flex-col" style={{ display: 'flex', gap: '1rem' }}>
                <h3>{editingReseller ? 'Edit Reseller' : 'Add Reseller'}</h3>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Reseller Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newResellerName}
                    onChange={e => setNewResellerName(e.target.value)}
                    placeholder="Enter reseller name"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Location / Info</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newResellerLocation}
                    onChange={e => setNewResellerLocation(e.target.value)}
                    placeholder="Location details..."
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary flex-1" style={{ justifyContent: 'center' }}>
                    {editingReseller ? 'Save' : 'Create'}
                  </button>
                  {editingReseller && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEditingReseller(null);
                        setNewResellerName('');
                        setNewResellerLocation('');
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              {/* Reseller Directory Grid */}
              <div className="table-container" style={{ margin: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Reseller Name</th>
                      <th>Location</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resellers.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>No resellers found.</td>
                      </tr>
                    ) : (
                      resellers.map(r => (
                        <tr key={r.reseller_ID}>
                          <td>{r.reseller_ID}</td>
                          <td className="font-semibold text-slate-800">{r.reseller_Name}</td>
                          <td>{r.reseller_Location || <span className="text-muted">-</span>}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex justify-between" style={{ display: 'inline-flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => {
                                  setEditingReseller(r);
                                  setNewResellerName(r.reseller_Name);
                                  setNewResellerLocation(r.reseller_Location || '');
                                }}
                                className="btn-secondary"
                                style={{ padding: '0.25rem 0.4rem', display: 'flex', alignItems: 'center' }}
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteReseller(r.reseller_ID)}
                                className="btn-secondary"
                                style={{ 
                                  padding: '0.25rem 0.4rem', 
                                  color: 'var(--status-inactive)', 
                                  borderColor: 'rgba(239, 68, 68, 0.2)',
                                  display: 'flex', 
                                  alignItems: 'center' 
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Restore Keys Panel */}
        {activeTab === 'restore' && (
          <>
            <header className="flex items-center justify-between" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h2>Restore Backup License Keys</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Retrieve archived serial numbers and restore them to active rotation</p>
              </div>
            </header>

            <section className="card grid" style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem',
              padding: '1rem'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem' }}>Product Code</label>
                <select className="form-input" value={restoreAppCode} onChange={e => setRestoreAppCode(e.target.value)}>
                  {restoreProductsList.map(([code, name]) => (
                    <option key={code} value={code}>{name} ({code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem' }}>Version Prefix</label>
                <input type="text" className="form-input" value={restoreVersion} onChange={e => setRestoreVersion(e.target.value)} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem' }}>Count</label>
                <input type="number" className="form-input" value={restoreNum} onChange={e => setRestoreNum(Number(e.target.value))} />
              </div>

              <div className="flex items-center" style={{ paddingTop: '1.2rem' }}>
                <label className="flex items-center gap-1 cursor-pointer" style={{ fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={restoreWithTest} onChange={e => setRestoreWithTest(e.target.checked)} />
                  Include Test
                </label>
              </div>

              <div className="flex items-end">
                <button onClick={handleLoadRestoreKeys} className="btn-primary w-full" style={{ justifyContent: 'center' }} disabled={loadingRestore}>
                  Load Backup Keys
                </button>
              </div>
            </section>

            <div className="card" style={{ flex: 1, overflowY: 'auto' }}>
              <div className="flex justify-between items-center" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{restoreKeysList.length} Backup Keys Found</span>
                <button 
                  onClick={handleRestoreKeys} 
                  className="btn-primary" 
                  style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                  disabled={selectedRestoreIds.length === 0 || loadingRestore}
                >
                  Restore Selected ({selectedRestoreIds.length})
                </button>
              </div>

              {loadingRestore ? (
                <p style={{ textAlign: 'center', padding: '3rem' }}>Loading backup keys...</p>
              ) : restoreKeysList.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No backup keys matching search criteria.</p>
              ) : (
                <div className="table-container" style={{ margin: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input 
                            type="checkbox" 
                            checked={restoreKeysList.length > 0 && selectedRestoreIds.length === restoreKeysList.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRestoreIds(restoreKeysList.map(k => k.sm_ID));
                              } else {
                                setSelectedRestoreIds([]);
                              }
                            }}
                          />
                        </th>
                        <th>SM ID</th>
                        <th>Serial Key</th>
                        <th>Remarks (SM_TEXT)</th>
                        <th>Application</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restoreKeysList.map(key => (
                        <tr key={key.sm_ID}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedRestoreIds.includes(key.sm_ID)}
                              onChange={() => {
                                setSelectedRestoreIds(prev => 
                                  prev.includes(key.sm_ID) 
                                    ? prev.filter(id => id !== key.sm_ID) 
                                    : [...prev, key.sm_ID]
                                );
                              }}
                            />
                          </td>
                          <td>{key.sm_ID}</td>
                          <td className="font-semibold" style={{ color: 'var(--accent-blue)' }}>{key.sm_SERIALNO}</td>
                          <td>{key.sm_TEXT || <span className="text-muted">-</span>}</td>
                          <td>{PRODUCT_MAPPINGS[key.sm_APPLICATION] || key.sm_APPLICATION}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Reset / Deleted History Tab */}
        {activeTab === 'deleted' && (
          <>
            <header style={{ marginBottom: '1.25rem' }}>
              <h2>Reset History Logs</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>View deleted license logs and historical client profile resets</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.25rem', alignItems: 'start', flex: 1 }}>
              <div className="table-container" style={{ margin: 0 }}>
                {loadingDeleted ? (
                  <p style={{ textAlign: 'center', padding: '3rem' }}>Loading deleted logs...</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Serial Key</th>
                        <th>User Name</th>
                        <th>Company</th>
                        <th>Deletion Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deletedHistoryList.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>No deleted license logs found.</td>
                        </tr>
                      ) : (
                        deletedHistoryList.map((row, idx) => (
                          <tr 
                            key={idx} 
                            onClick={() => handleLoadDeletedSubscriptions(row)}
                            style={{ 
                              cursor: 'pointer',
                              backgroundColor: selectedDeletedRow?.sM_SERIALNO === row.sM_SERIALNO ? 'rgba(6, 115, 186, 0.08)' : 'transparent',
                              borderLeft: selectedDeletedRow?.sM_SERIALNO === row.sM_SERIALNO ? '3px solid var(--accent-blue)' : 'none'
                            }}
                          >
                            <td className="font-semibold text-rose-600">{row.sM_SERIALNO}</td>
                            <td>{row.cD_USERNAME || '-'}</td>
                            <td>{row.cD_COMPANYNAME || '-'}</td>
                            <td>{row.cD_DATE ? new Date(row.cD_DATE).toLocaleDateString() : '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Deleted details sidebar */}
              {selectedDeletedRow ? (
                <div className="card flex-col" style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0 }}>Deleted Profile Logs</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Key: {selectedDeletedRow.sM_SERIALNO}</p>
                  </div>

                  <div style={{ fontSize: '0.8rem' }}>
                    <p><strong>Username:</strong> {selectedDeletedRow.cD_USERNAME || '-'}</p>
                    <p><strong>Company:</strong> {selectedDeletedRow.cD_COMPANYNAME || '-'}</p>
                    <p><strong>Email:</strong> {selectedDeletedRow.cD_EMAIL || '-'}</p>
                    <p><strong>Phone:</strong> {selectedDeletedRow.cD_PHONENO || '-'}</p>
                    <p><strong>Registration Date:</strong> {selectedDeletedRow.cD_DATE ? new Date(selectedDeletedRow.cD_DATE).toLocaleDateString() : '-'}</p>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <h5 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Deleted Subscription Logs</h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '300px', overflowY: 'auto' }}>
                      {deletedSubscriptions.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>No deleted subscriptions.</p>
                      ) : (
                        deletedSubscriptions.map((sub, idx) => (
                          <div key={idx} style={{
                            backgroundColor: '#ffffff',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.75rem'
                          }}>
                            <div className="flex justify-between font-semibold">
                              <span>+{sub.sD_DAYS} Days ({sub.sD_VERSION || 'N/A'})</span>
                              <span className="text-muted">{sub.sD_DATE ? new Date(sub.sD_DATE).toLocaleDateString() : ''}</span>
                            </div>
                            {sub.sD_REMARKS && <p className="text-muted" style={{ fontSize: '0.65rem', marginTop: '0.1rem' }}>Remarks: {sub.sD_REMARKS}</p>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card flex items-center justify-center text-muted" style={{ padding: '3rem', textAlign: 'center' }}>
                  Click on a deleted key entry to view its historic profile and subscription list.
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* DaysLeft Breakdown / Show Calc report popup modal */}
      {showCalcModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 500
        }}>
          <div className="card flex-col" style={{
            width: '650px',
            maxHeight: '80vh',
            display: 'flex',
            backgroundColor: '#ffffff',
            padding: '1.5rem',
            gap: '1rem'
          }}>
            <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h4 style={{ margin: 0 }}>Days Left Calculation Breakdown</h4>
              <button onClick={() => setShowCalcModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingCalc ? (
                <p style={{ textAlign: 'center', padding: '2rem' }}>Calculating license breakdown...</p>
              ) : (
                <pre style={{
                  backgroundColor: '#f1f5f9',
                  padding: '1rem',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-primary)'
                }}>
                  {calcSummaryText}
                </pre>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={() => setShowCalcModal(false)} className="btn-primary" style={{ padding: '0.5rem 1.2rem' }}>
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Parent-Child Keys Modal */}
      {showLinkModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 500
        }}>
          <form onSubmit={handleLinkKeys} className="card flex-col" style={{
            width: '450px',
            backgroundColor: '#ffffff',
            padding: '1.5rem',
            gap: '1rem'
          }}>
            <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h4 style={{ margin: 0 }}>Establish Parent-Child License Link</h4>
              <button type="button" onClick={() => setShowLinkModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Link the selected serial key to a secondary key to share seat distributions.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Source Serial Key (Parent)</label>
              <input type="text" className="form-input text-muted" value={selectedRow?.sm_SERIALNO || ''} disabled style={{ backgroundColor: '#f1f5f9' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Target Serial Key (Child)</label>
              <input 
                type="text" 
                className="form-input" 
                value={linkTargetSerial} 
                onChange={e => setLinkTargetSerial(e.target.value)} 
                placeholder="Enter target serial"
                required 
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 cursor-pointer" style={{ fontSize: '0.85rem' }}>
                <input type="checkbox" checked={linkUpdateTotalDays} onChange={e => setLinkUpdateTotalDays(e.target.checked)} />
                Update Target Total Days
              </label>
            </div>

            {linkUpdateTotalDays && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Total Days</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={linkTotalDays} 
                  onChange={e => setLinkTotalDays(Number(e.target.value))} 
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Remarks (Remarks for both keys)</label>
              <input 
                type="text" 
                className="form-input" 
                value={linkRemarks} 
                onChange={e => setLinkRemarks(e.target.value)} 
                placeholder="Enter linking comments"
              />
            </div>

            <div className="flex justify-end gap-2" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <button type="button" onClick={() => setShowLinkModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Establish Link
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Copy Emails Aggregator Wizard Modal */}
      {showEmailsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 500
        }}>
          <div className="card flex-col" style={{
            width: '600px',
            backgroundColor: '#ffffff',
            padding: '1.5rem',
            gap: '1rem',
            maxHeight: '80vh',
            display: 'flex'
          }}>
            <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h4 style={{ margin: 0 }}>Client Email Aggregator Wizard</h4>
              <button onClick={() => setShowEmailsModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Select specific products. The system will load all active registered machines and aggregate unique client emails separated by semicolons.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flex: 1, overflowY: 'auto' }}>
              {/* CADdirekt list */}
              <div>
                <h5 style={{ fontSize: '0.8rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem' }}>CADdirekt</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.4rem' }}>
                  {CADDIREKT_PRODUCTS.map(code => (
                    <label key={code} className="flex items-center gap-1" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={emailWizardProducts.includes(code)}
                        onChange={(e) => {
                          setEmailWizardProducts(prev => 
                            e.target.checked ? [...prev, code] : prev.filter(c => c !== code)
                          );
                        }}
                      />
                      {PRODUCT_MAPPINGS[code] || code}
                    </label>
                  ))}
                </div>
              </div>

              {/* Bluebeam list */}
              <div>
                <h5 style={{ fontSize: '0.8rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem' }}>Bluebeam / Add-ons</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.4rem' }}>
                  {BLUEBEAM_PRODUCTS.map(code => (
                    <label key={code} className="flex items-center gap-1" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={emailWizardProducts.includes(code)}
                        onChange={(e) => {
                          setEmailWizardProducts(prev => 
                            e.target.checked ? [...prev, code] : prev.filter(c => c !== code)
                          );
                        }}
                      />
                      {PRODUCT_MAPPINGS[code] || code}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Email Result Box */}
            {wizardEmailsResult && (
              <div style={{ marginTop: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>Aggregated Email Lists</label>
                <textarea 
                  className="form-input" 
                  value={wizardEmailsResult} 
                  readOnly 
                  rows={4} 
                  style={{ fontFamily: 'monospace', fontSize: '0.75rem', backgroundColor: '#f1f5f9' }}
                />
              </div>
            )}

            <div className="flex justify-between items-center" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <div className="flex gap-2">
                <button 
                  onClick={() => setEmailWizardProducts([...CADDIREKT_PRODUCTS, ...BLUEBEAM_PRODUCTS])} 
                  className="btn-secondary" 
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                >
                  Select All
                </button>
                <button 
                  onClick={() => setEmailWizardProducts([])} 
                  className="btn-secondary" 
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                >
                  Clear All
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowEmailsModal(false)} className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                  Close
                </button>
                {wizardEmailsResult ? (
                  <button onClick={handleCopyEmailsToClipboard} className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                    Copy to Clipboard
                  </button>
                ) : (
                  <button 
                    onClick={handleGenerateAggregation} 
                    className="btn-primary" 
                    style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                    disabled={emailWizardProducts.length === 0 || loadingEmails}
                  >
                    {loadingEmails ? 'Compiling...' : 'Generate Emails'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
