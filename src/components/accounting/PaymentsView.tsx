import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../common/PageHeader';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  PaymentAccount,
  PaymentAccountType,
  FundTransferRecord,
  PaymentAccountStatementItem,
  Account,
  ManualAdjustmentRecord,
} from '../../types';
import {
  Wallet,
  Building2,
  Smartphone,
  Coins,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Calendar,
  Lock,
  Unlock,
  Filter,
  Check,
  Download,
  Receipt,
  Layers,
  Sliders,
  RotateCcw,
  Ban,
} from 'lucide-react';

export const PaymentsView: React.FC = () => {
  const {
    paymentAccounts,
    fundTransfers,
    manualAdjustments,
    accounts,
    fetchPaymentAccounts,
    fetchPaymentAccountStatement,
    createPaymentAccount,
    updatePaymentAccount,
    togglePaymentAccountActive,
    transferFunds,
    depositFunds,
    withdrawFunds,
    fetchFundTransfers,
    fetchManualAdjustments,
    createManualAdjustment,
    voidManualAdjustment,
    refreshAll,
  } = useApp();

  const { currentUser, can, tier } = useAuth();

  // Navigation tabs: 'accounts' | 'transfers' | 'adjustments' | 'journal'
  const [activeTab, setActiveTab] = useState<'accounts' | 'transfers' | 'adjustments' | 'journal'>('accounts');

  // Search and filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<PaymentAccount | null>(null);

  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [transferFromId, setTransferFromId] = useState<string>('');
  const [transferToId, setTransferToId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [transferFee, setTransferFee] = useState<string>('');
  const [transferRef, setTransferRef] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');

  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [depositAccountId, setDepositAccountId] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [depositSourceType, setDepositSourceType] = useState<'capital_injection' | 'bank_interest' | 'cash_deposit' | 'customer_advance' | 'other_income'>('capital_injection');
  const [depositRef, setDepositRef] = useState<string>('');
  const [depositNotes, setDepositNotes] = useState<string>('');

  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [withdrawAccountId, setWithdrawAccountId] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawDate, setWithdrawDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [withdrawReasonType, setWithdrawReasonType] = useState<'owner_drawings' | 'bank_charge' | 'external_withdrawal' | 'other_expense'>('owner_drawings');
  const [withdrawRef, setWithdrawRef] = useState<string>('');
  const [withdrawNotes, setWithdrawNotes] = useState<string>('');

  // Manual Adjustments & Financial Exception State (Phase 2)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<boolean>(false);
  const [adjustAccountId, setAdjustAccountId] = useState<string>('');
  const [adjustDirection, setAdjustDirection] = useState<'money_in' | 'money_out'>('money_in');
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustDate, setAdjustDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [adjustReasonCategory, setAdjustReasonCategory] = useState<ManualAdjustmentRecord['reason_category']>('gateway_sync_correction');
  const [adjustReasonNotes, setAdjustReasonNotes] = useState<string>('');
  const [adjustReference, setAdjustReference] = useState<string>('');
  const [adjustOffsetAccountId, setAdjustOffsetAccountId] = useState<string>('acc_gain_loss_adj');

  const [showVoidModal, setShowVoidModal] = useState<boolean>(false);
  const [voidTargetAdjustment, setVoidTargetAdjustment] = useState<ManualAdjustmentRecord | null>(null);
  const [voidReasonText, setVoidReasonText] = useState<string>('');

  // Account Book / Statement View State
  const [selectedStatementAccountId, setSelectedStatementAccountId] = useState<string | null>(null);
  const [statementData, setStatementData] = useState<{
    account: PaymentAccount;
    statement: PaymentAccountStatementItem[];
    opening_balance: number;
    total_inflow: number;
    total_outflow: number;
    closing_balance: number;
  } | null>(null);
  const [statementStartDate, setStatementStartDate] = useState<string>('');
  const [statementEndDate, setStatementEndDate] = useState<string>('');
  const [statementTypeFilter, setStatementTypeFilter] = useState<string>('all');
  const [loadingStatement, setLoadingStatement] = useState<boolean>(false);

  // Form handling state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Account creation / edit form state
  const [formName, setFormName] = useState<string>('');
  const [formType, setFormType] = useState<PaymentAccountType>('bank');
  const [formNumber, setFormNumber] = useState<string>('');
  const [formBankName, setFormBankName] = useState<string>('');
  const [formBranchName, setFormBranchName] = useState<string>('');
  const [formRoutingNumber, setFormRoutingNumber] = useState<string>('');
  const [formLinkedCoaId, setFormLinkedCoaId] = useState<string>('acc_bank');
  const [formOpeningBal, setFormOpeningBal] = useState<string>('0');
  const [formIsDefaultPos, setFormIsDefaultPos] = useState<boolean>(false);
  const [formIsDefaultCourier, setFormIsDefaultCourier] = useState<boolean>(false);
  const [formIsDefaultPayroll, setFormIsDefaultPayroll] = useState<boolean>(false);
  const [formIsDefaultExpense, setFormIsDefaultExpense] = useState<boolean>(false);
  const [formNotes, setFormNotes] = useState<string>('');

  // Check RBAC permission for financial management
  const isFinanceAdmin = tier === 1 || can('manage_accounts') || can('view_full_accounting_pnl');

  // Load statement when selectedStatementAccountId changes
  const loadStatement = async (accountId: string, start?: string, end?: string) => {
    setLoadingStatement(true);
    try {
      const data = await fetchPaymentAccountStatement(accountId, start, end);
      setStatementData(data);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to load statement' });
    } finally {
      setLoadingStatement(false);
    }
  };

  useEffect(() => {
    if (selectedStatementAccountId) {
      loadStatement(selectedStatementAccountId, statementStartDate, statementEndDate);
    }
  }, [selectedStatementAccountId, statementStartDate, statementEndDate]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const active = paymentAccounts.filter(a => a.is_active);
    const totalLiquid = active.reduce((s, a) => s + (a.current_balance || 0), 0);
    const cashTotal = active.filter(a => a.account_type === 'cash' || a.account_type === 'petty_cash').reduce((s, a) => s + (a.current_balance || 0), 0);
    const bankTotal = active.filter(a => a.account_type === 'bank').reduce((s, a) => s + (a.current_balance || 0), 0);
    const mobileTotal = active.filter(a => a.account_type === 'bkash' || a.account_type === 'nagad' || a.account_type === 'rocket' || a.account_type === 'upay').reduce((s, a) => s + (a.current_balance || 0), 0);
    return { totalLiquid, cashTotal, bankTotal, mobileTotal, activeCount: active.length, totalCount: paymentAccounts.length };
  }, [paymentAccounts]);

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return paymentAccounts.filter(acc => {
      if (statusFilter === 'active' && !acc.is_active) return false;
      if (statusFilter === 'inactive' && acc.is_active) return false;
      if (typeFilter !== 'all' && acc.account_type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          acc.account_name.toLowerCase().includes(q) ||
          acc.account_number.toLowerCase().includes(q) ||
          (acc.bank_name && acc.bank_name.toLowerCase().includes(q)) ||
          (acc.linked_chart_account_name && acc.linked_chart_account_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [paymentAccounts, statusFilter, typeFilter, searchQuery]);

  // Open Create Account Modal
  const handleOpenCreateModal = () => {
    setEditingAccount(null);
    setFormName('');
    setFormType('bank');
    setFormNumber('');
    setFormBankName('');
    setFormBranchName('');
    setFormRoutingNumber('');
    setFormLinkedCoaId('acc_bank');
    setFormOpeningBal('0');
    setFormIsDefaultPos(false);
    setFormIsDefaultCourier(false);
    setFormIsDefaultPayroll(false);
    setFormIsDefaultExpense(false);
    setFormNotes('');
    setActionError('');
    setShowCreateModal(true);
  };

  // Open Edit Account Modal
  const handleOpenEditModal = (acc: PaymentAccount) => {
    setEditingAccount(acc);
    setFormName(acc.account_name);
    setFormType(acc.account_type);
    setFormNumber(acc.account_number);
    setFormBankName(acc.bank_name || '');
    setFormBranchName(acc.branch_name || '');
    setFormRoutingNumber(acc.routing_number || '');
    setFormLinkedCoaId(acc.linked_chart_account_id);
    setFormOpeningBal(String(acc.opening_balance));
    setFormIsDefaultPos(Boolean(acc.is_default_pos));
    setFormIsDefaultCourier(Boolean(acc.is_default_courier_settlement));
    setFormIsDefaultPayroll(Boolean(acc.is_default_payroll));
    setFormIsDefaultExpense(Boolean(acc.is_default_expense));
    setFormNotes(acc.notes || '');
    setActionError('');
    setShowCreateModal(true);
  };

  // Submit Account Save
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formNumber.trim()) {
      setActionError('Account name and account number/identifier are required.');
      return;
    }
    setIsSubmitting(true);
    setActionError('');
    try {
      if (editingAccount) {
        await updatePaymentAccount(editingAccount.id, {
          account_name: formName,
          account_number: formNumber,
          bank_name: formBankName,
          branch_name: formBranchName,
          routing_number: formRoutingNumber,
          linked_chart_account_id: formLinkedCoaId,
          is_default_pos: formIsDefaultPos,
          is_default_courier_settlement: formIsDefaultCourier,
          is_default_payroll: formIsDefaultPayroll,
          is_default_expense: formIsDefaultExpense,
          notes: formNotes,
        });
        setFeedbackMsg({ type: 'success', text: `Account ${formName} updated successfully.` });
      } else {
        await createPaymentAccount({
          account_name: formName,
          account_type: formType,
          account_number: formNumber,
          bank_name: formBankName,
          branch_name: formBranchName,
          routing_number: formRoutingNumber,
          linked_chart_account_id: formLinkedCoaId,
          opening_balance: Number(formOpeningBal) || 0,
          is_default_pos: formIsDefaultPos,
          is_default_courier_settlement: formIsDefaultCourier,
          is_default_payroll: formIsDefaultPayroll,
          is_default_expense: formIsDefaultExpense,
          notes: formNotes,
        });
        setFeedbackMsg({ type: 'success', text: `Payment account ${formName} created and linked to general ledger.` });
      }
      setShowCreateModal(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save account');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Account Active / Inactive
  const handleToggleActive = async (acc: PaymentAccount) => {
    const confirmMsg = acc.is_active
      ? `Deactivate ${acc.account_name}? It will no longer accept new transactions, but all transaction history and statements remain intact.`
      : `Re-activate ${acc.account_name}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await togglePaymentAccountActive(acc.id, !acc.is_active);
      setFeedbackMsg({
        type: 'success',
        text: `Account ${acc.account_name} ${!acc.is_active ? 'activated' : 'deactivated'} successfully.`,
      });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to update status' });
    }
  };

  // Open Transfer Modal
  const handleOpenTransferModal = (fromAccId?: string) => {
    const active = paymentAccounts.filter(a => a.is_active);
    const defaultFrom = fromAccId || (active[0]?.id || '');
    const defaultTo = active.find(a => a.id !== defaultFrom)?.id || '';
    setTransferFromId(defaultFrom);
    setTransferToId(defaultTo);
    setTransferAmount('');
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferFee('');
    setTransferRef('');
    setTransferNotes('');
    setActionError('');
    setShowTransferModal(true);
  };

  // Submit Fund Transfer
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(transferAmount);
    if (!transferFromId || !transferToId) {
      setActionError('Source and destination accounts are required.');
      return;
    }
    if (transferFromId === transferToId) {
      setActionError('Source and destination accounts must be different.');
      return;
    }
    if (!amt || amt <= 0) {
      setActionError('Please enter a valid transfer amount.');
      return;
    }

    setIsSubmitting(true);
    setActionError('');
    try {
      const result = await transferFunds({
        from_account_id: transferFromId,
        to_account_id: transferToId,
        amount: amt,
        transfer_date: transferDate,
        fee_amount: Number(transferFee) || 0,
        reference: transferRef,
        notes: transferNotes,
      });
      setShowTransferModal(false);
      setFeedbackMsg({
        type: 'success',
        text: `Transferred ৳${amt.toLocaleString()} successfully. Balanced journal entry ${result.journal_entry.entry_number} posted.`,
      });
    } catch (err: any) {
      setActionError(err.message || 'Transfer failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Deposit Modal
  const handleOpenDepositModal = (accId?: string) => {
    setDepositAccountId(accId || paymentAccounts.find(a => a.is_active)?.id || '');
    setDepositAmount('');
    setDepositDate(new Date().toISOString().slice(0, 10));
    setDepositSourceType('capital_injection');
    setDepositRef('');
    setDepositNotes('');
    setActionError('');
    setShowDepositModal(true);
  };

  // Submit Deposit
  const handleExecuteDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(depositAmount);
    if (!depositAccountId) {
      setActionError('Please select a payment account.');
      return;
    }
    if (!amt || amt <= 0) {
      setActionError('Please enter a valid deposit amount.');
      return;
    }

    setIsSubmitting(true);
    setActionError('');
    try {
      const result = await depositFunds({
        payment_account_id: depositAccountId,
        amount: amt,
        deposit_date: depositDate,
        source_type: depositSourceType,
        reference: depositRef,
        notes: depositNotes,
      });
      setShowDepositModal(false);
      setFeedbackMsg({
        type: 'success',
        text: `Deposited ৳${amt.toLocaleString()} successfully. Balanced journal entry ${result.journal_entry.entry_number} posted.`,
      });
    } catch (err: any) {
      setActionError(err.message || 'Deposit failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Withdrawal Modal
  const handleOpenWithdrawModal = (accId?: string) => {
    setWithdrawAccountId(accId || paymentAccounts.find(a => a.is_active)?.id || '');
    setWithdrawAmount('');
    setWithdrawDate(new Date().toISOString().slice(0, 10));
    setWithdrawReasonType('owner_drawings');
    setWithdrawRef('');
    setWithdrawNotes('');
    setActionError('');
    setShowWithdrawModal(true);
  };

  // Submit Withdrawal
  const handleExecuteWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(withdrawAmount);
    if (!withdrawAccountId) {
      setActionError('Please select a payment account.');
      return;
    }
    if (!amt || amt <= 0) {
      setActionError('Please enter a valid withdrawal amount.');
      return;
    }

    setIsSubmitting(true);
    setActionError('');
    try {
      const result = await withdrawFunds({
        payment_account_id: withdrawAccountId,
        amount: amt,
        withdrawal_date: withdrawDate,
        reason_type: withdrawReasonType,
        reference: withdrawRef,
        notes: withdrawNotes,
      });
      setShowWithdrawModal(false);
      setFeedbackMsg({
        type: 'success',
        text: `Withdrew ৳${amt.toLocaleString()} successfully. Balanced journal entry ${result.journal_entry.entry_number} posted.`,
      });
    } catch (err: any) {
      setActionError(err.message || 'Withdrawal failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Adjustment Modal
  const handleOpenAdjustmentModal = (accountId?: string) => {
    const defaultAcc = accountId
      ? paymentAccounts.find((a) => a.id === accountId)
      : paymentAccounts.find((a) => a.is_active);
    setAdjustAccountId(defaultAcc?.id || (paymentAccounts[0]?.id ?? ''));
    setAdjustDirection('money_in');
    setAdjustAmount('');
    setAdjustDate(new Date().toISOString().slice(0, 10));
    setAdjustReasonCategory('gateway_sync_correction');
    setAdjustReasonNotes('');
    setAdjustReference('');
    setAdjustOffsetAccountId('acc_gain_loss_adj');
    setActionError('');
    setShowAdjustmentModal(true);
  };

  // Execute Adjustment
  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(adjustAmount);
    if (!adjustAccountId) {
      setActionError('Please select a payment account.');
      return;
    }
    if (!amt || amt <= 0) {
      setActionError('Please enter a valid positive adjustment amount.');
      return;
    }
    if (!adjustReasonNotes.trim()) {
      setActionError('Please enter a detailed explanation/notes for this audit adjustment.');
      return;
    }
    if (!adjustOffsetAccountId) {
      setActionError('Please select an offset General Ledger account.');
      return;
    }

    setIsSubmitting(true);
    setActionError('');
    try {
      const result = await createManualAdjustment({
        payment_account_id: adjustAccountId,
        direction: adjustDirection,
        amount: amt,
        offset_account_id: adjustOffsetAccountId,
        adjustment_date: adjustDate,
        reason_category: adjustReasonCategory,
        reason_notes: adjustReasonNotes,
        reference: adjustReference,
      });
      setShowAdjustmentModal(false);
      setFeedbackMsg({
        type: 'success',
        text: `Manual Adjustment ${result.adjustment.adjustment_number} posted (${adjustDirection === 'money_in' ? '+' : '-'}৳${amt.toLocaleString()}). Balanced Journal ${result.journal_entry.entry_number} recorded.`,
      });
    } catch (err: any) {
      setActionError(err.message || 'Adjustment posting failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Void Modal
  const handleOpenVoidModal = (adj: ManualAdjustmentRecord) => {
    setVoidTargetAdjustment(adj);
    setVoidReasonText('');
    setActionError('');
    setShowVoidModal(true);
  };

  // Execute Void
  const handleExecuteVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTargetAdjustment) return;
    if (!voidReasonText.trim()) {
      setActionError('A clear reason is required to void and reverse an adjustment.');
      return;
    }

    setIsSubmitting(true);
    setActionError('');
    try {
      const result = await voidManualAdjustment(voidTargetAdjustment.id, voidReasonText);
      setShowVoidModal(false);
      setVoidTargetAdjustment(null);
      setFeedbackMsg({
        type: 'success',
        text: `Adjustment ${result.adjustment.adjustment_number} voided. Reversal journal ${result.reversal_journal_entry.entry_number} posted.`,
      });
    } catch (err: any) {
      setActionError(err.message || 'Failed to void adjustment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for Account Type Badge
  const renderAccountTypeBadge = (type: PaymentAccountType) => {
    switch (type) {
      case 'cash':
      case 'petty_cash':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/60">
            <Coins className="w-3 h-3" /> Cash Till
          </span>
        );
      case 'bank':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-950/40 text-blue-300 border border-blue-800/60">
            <Building2 className="w-3 h-3" /> Bank
          </span>
        );
      case 'bkash':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-pink-950/40 text-pink-300 border border-pink-800/60">
            <Smartphone className="w-3 h-3" /> bKash
          </span>
        );
      case 'nagad':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-950/40 text-orange-300 border border-orange-800/60">
            <Smartphone className="w-3 h-3" /> Nagad
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
            <Wallet className="w-3 h-3" /> Wallet
          </span>
        );
    }
  };

  // Filtered statement items
  const filteredStatementItems = useMemo(() => {
    if (!statementData?.statement) return [];
    if (statementTypeFilter === 'all') return statementData.statement;
    return statementData.statement.filter(item => item.transaction_type === statementTypeFilter);
  }, [statementData, statementTypeFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Payment Accounts & Financial Control"
        desc="Authoritative operational bank, cash, and mobile money ledgers linked to General Ledger"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshAll()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs font-medium hover:bg-zinc-800 transition"
              title="Refresh balances"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            {isFinanceAdmin && (
              <>
                <button
                  onClick={() => handleOpenAdjustmentModal()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 text-xs font-medium hover:bg-zinc-700 transition"
                  title="Record controlled manual exception adjustment"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" /> Adjust Balance
                </button>
                <button
                  onClick={() => handleOpenTransferModal()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 text-xs font-medium hover:bg-zinc-700 transition"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" /> Transfer Funds
                </button>
                <button
                  onClick={() => handleOpenDepositModal()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 text-xs font-medium hover:bg-zinc-700 transition"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" /> Deposit
                </button>
                <button
                  onClick={() => handleOpenWithdrawModal()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 text-xs font-medium hover:bg-zinc-700 transition"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" /> Withdrawal
                </button>
                <button
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Account
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-zinc-400">Total Liquid Funds</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1 tabular-nums">
            ৳{metrics.totalLiquid.toLocaleString()}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            {metrics.activeCount} active operational accounts
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-zinc-400">Cash in Hand & Tills</div>
          <div className="text-xl font-semibold text-emerald-400 mt-1 tabular-nums">
            ৳{metrics.cashTotal.toLocaleString()}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Shop showroom physical cash</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-zinc-400">Bank Accounts</div>
          <div className="text-xl font-semibold text-blue-400 mt-1 tabular-nums">
            ৳{metrics.bankTotal.toLocaleString()}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Corporate checking & personal bank</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-zinc-400">Mobile Money (bKash/Nagad)</div>
          <div className="text-xl font-semibold text-pink-400 mt-1 tabular-nums">
            ৳{metrics.mobileTotal.toLocaleString()}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Merchant digital wallets</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-800 text-xs font-medium">
        <button
          onClick={() => {
            setActiveTab('accounts');
            setSelectedStatementAccountId(null);
          }}
          className={`px-4 py-2 border-b-2 transition ${
            activeTab === 'accounts' && !selectedStatementAccountId
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Payment Accounts ({paymentAccounts.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('transfers');
            setSelectedStatementAccountId(null);
          }}
          className={`px-4 py-2 border-b-2 transition ${
            activeTab === 'transfers'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Internal Transfers ({fundTransfers.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('adjustments');
            setSelectedStatementAccountId(null);
          }}
          className={`px-4 py-2 border-b-2 transition ${
            activeTab === 'adjustments'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Manual Adjustments ({manualAdjustments.length})
        </button>
        {selectedStatementAccountId && (
          <button
            className="px-4 py-2 border-b-2 border-blue-500 text-blue-400 font-semibold flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Statement: {statementData?.account.account_name || 'Account Book'}
            <span
              onClick={(e) => {
                e.stopPropagation();
                setSelectedStatementAccountId(null);
              }}
              className="ml-1.5 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        )}
      </div>

      {/* TAB 1: PAYMENT ACCOUNTS LIST */}
      {activeTab === 'accounts' && !selectedStatementAccountId && (
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search account name, number, bank..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-300 text-xs focus:outline-none focus:border-zinc-700"
              >
                <option value="all">All Types</option>
                <option value="bank">Bank Accounts</option>
                <option value="cash">Cash Tills</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-300 text-xs focus:outline-none focus:border-zinc-700"
              >
                <option value="active">Active Accounts</option>
                <option value="inactive">Inactive Accounts</option>
                <option value="all">All Statuses</option>
              </select>
            </div>

            <div className="text-zinc-500 text-[11px]">
              Showing {filteredAccounts.length} of {paymentAccounts.length} accounts
            </div>
          </div>

          {/* Accounts Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-medium">
                    <th className="py-2.5 px-3">Account Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Account / Identifier</th>
                    <th className="py-2.5 px-3">Bank & Branch</th>
                    <th className="py-2.5 px-3">Linked General Ledger COA</th>
                    <th className="py-2.5 px-3">Default Roles</th>
                    <th className="py-2.5 px-3 text-right">Authoritative Balance</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-zinc-500 text-xs">
                        No payment accounts found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => {
                      const isZero = acc.current_balance === 0;
                      const isNegative = acc.current_balance < 0;

                      return (
                        <tr
                          key={acc.id}
                          className={`hover:bg-zinc-800/40 transition ${!acc.is_active ? 'opacity-60 bg-zinc-950/50' : ''}`}
                        >
                          <td className="py-2.5 px-3 font-medium text-zinc-100">
                            <div className="flex items-center gap-2">
                              <span>{acc.account_name}</span>
                              {!acc.is_active && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {acc.notes && <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{acc.notes}</div>}
                          </td>

                          <td className="py-2.5 px-3">{renderAccountTypeBadge(acc.account_type)}</td>

                          <td className="py-2.5 px-3 text-zinc-300 font-mono text-[11px]">{acc.account_number}</td>

                          <td className="py-2.5 px-3 text-zinc-300">
                            {acc.bank_name ? (
                              <div>
                                <div className="font-medium text-zinc-200">{acc.bank_name}</div>
                                {acc.branch_name && <div className="text-[10px] text-zinc-500">{acc.branch_name}</div>}
                              </div>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="text-zinc-300">
                              <span className="font-mono text-[11px] text-zinc-400 mr-1.5">
                                {acc.linked_chart_account_code || '10xx'}
                              </span>
                              <span>{acc.linked_chart_account_name || acc.linked_chart_account_id}</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {acc.is_default_pos && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/50 text-emerald-400 border border-emerald-800/50 font-mono">
                                  POS Default
                                </span>
                              )}
                              {acc.is_default_courier_settlement && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-950/50 text-blue-400 border border-blue-800/50 font-mono">
                                  Courier COD
                                </span>
                              )}
                              {acc.is_default_payroll && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/50 text-purple-400 border border-purple-800/50 font-mono">
                                  Payroll
                                </span>
                              )}
                              {acc.is_default_expense && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/50 text-amber-400 border border-amber-800/50 font-mono">
                                  Expenses
                                </span>
                              )}
                              {!acc.is_default_pos &&
                                !acc.is_default_courier_settlement &&
                                !acc.is_default_payroll &&
                                !acc.is_default_expense && <span className="text-zinc-600 text-[11px]">—</span>}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div
                              className={`font-semibold tabular-nums ${
                                isNegative ? 'text-rose-400' : isZero ? 'text-zinc-500' : 'text-zinc-100'
                              }`}
                            >
                              ৳{acc.current_balance.toLocaleString()}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {acc.is_active ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span> Inactive
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setSelectedStatementAccountId(acc.id)}
                                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] font-medium transition flex items-center gap-1"
                                title="View Statement / Account Book"
                              >
                                <FileText className="w-3 h-3 text-blue-400" /> Book
                              </button>

                              {isFinanceAdmin && (
                                <>
                                  <button
                                    onClick={() => handleOpenAdjustmentModal(acc.id)}
                                    disabled={!acc.is_active}
                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] font-medium transition disabled:opacity-40"
                                    title="Post manual exception adjustment"
                                  >
                                    <Sliders className="w-3 h-3 text-amber-400" />
                                  </button>

                                  <button
                                    onClick={() => handleOpenTransferModal(acc.id)}
                                    disabled={!acc.is_active}
                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] font-medium transition disabled:opacity-40"
                                    title="Transfer out of this account"
                                  >
                                    <ArrowLeftRight className="w-3 h-3 text-blue-400" />
                                  </button>

                                  <button
                                    onClick={() => handleOpenEditModal(acc)}
                                    className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition"
                                    title="Edit account details"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleToggleActive(acc)}
                                    className={`p-1 hover:bg-zinc-800 rounded transition ${
                                      acc.is_active ? 'text-zinc-500 hover:text-amber-400' : 'text-zinc-500 hover:text-emerald-400'
                                    }`}
                                    title={acc.is_active ? 'Deactivate account' : 'Activate account'}
                                  >
                                    {acc.is_active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTERNAL TRANSFERS LIST */}
      {activeTab === 'transfers' && !selectedStatementAccountId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg text-xs">
            <div className="text-zinc-300 font-medium">Internal Fund Transfers Audit Log</div>
            {isFinanceAdmin && (
              <button
                onClick={() => handleOpenTransferModal()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" /> New Transfer
              </button>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-medium">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Transfer #</th>
                    <th className="py-2.5 px-3">Source Account (Credit)</th>
                    <th className="py-2.5 px-3">Destination Account (Debit)</th>
                    <th className="py-2.5 px-3 text-right">Transfer Amount</th>
                    <th className="py-2.5 px-3 text-right">Fee / Charge</th>
                    <th className="py-2.5 px-3">Reference / Slip</th>
                    <th className="py-2.5 px-3">Journal Ref</th>
                    <th className="py-2.5 px-3">Initiated By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {fundTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-zinc-500 text-xs">
                        No fund transfers recorded yet.
                      </td>
                    </tr>
                  ) : (
                    fundTransfers.map((trf) => (
                      <tr key={trf.id} className="hover:bg-zinc-800/40 transition">
                        <td className="py-2.5 px-3 text-zinc-300 font-mono text-[11px]">{trf.transfer_date}</td>
                        <td className="py-2.5 px-3 font-mono font-medium text-zinc-100">{trf.transfer_number}</td>
                        <td className="py-2.5 px-3 text-rose-400 font-medium">{trf.from_account_name}</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-medium">{trf.to_account_name}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-zinc-100 tabular-nums">
                          ৳{trf.amount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-400 tabular-nums">
                          {trf.fee_amount ? `৳${trf.fee_amount.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 text-[11px]">{trf.reference || '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-500">{trf.journal_entry_id || '—'}</td>
                        <td className="py-2.5 px-3 text-zinc-400">{trf.created_by_name}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MANUAL ADJUSTMENTS AUDIT LOG */}
      {activeTab === 'adjustments' && !selectedStatementAccountId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg text-xs">
            <div>
              <div className="text-zinc-200 font-medium">Manual Financial Adjustments Audit Log</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                Double-entry adjustment records for unrecorded POS collections, sync variances, and audit corrections
              </div>
            </div>
            {isFinanceAdmin && (
              <button
                onClick={() => handleOpenAdjustmentModal()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" /> New Adjustment
              </button>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-medium">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Adjustment #</th>
                    <th className="py-2.5 px-3">Payment Account</th>
                    <th className="py-2.5 px-3">Direction</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Reason Category</th>
                    <th className="py-2.5 px-3">Explanation & Reference</th>
                    <th className="py-2.5 px-3">Offset COA</th>
                    <th className="py-2.5 px-3">Journal Ref</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Created By</th>
                    {isFinanceAdmin && <th className="py-2.5 px-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {manualAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-zinc-500 text-xs">
                        No manual financial adjustments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    manualAdjustments.map((adj) => (
                      <tr key={adj.id} className="hover:bg-zinc-800/40 transition">
                        <td className="py-2.5 px-3 text-zinc-300 font-mono text-[11px]">{adj.adjustment_date}</td>
                        <td className="py-2.5 px-3 font-mono font-medium text-zinc-100">{adj.adjustment_number}</td>
                        <td className="py-2.5 px-3 text-zinc-200 font-medium">{adj.payment_account_name}</td>
                        <td className="py-2.5 px-3">
                          {adj.direction === 'money_in' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-medium">
                              <ArrowDownLeft className="w-3 h-3" /> Money In (+)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-950/60 text-rose-400 border border-rose-800/60 font-medium">
                              <ArrowUpRight className="w-3 h-3" /> Money Out (-)
                            </span>
                          )}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold tabular-nums ${adj.direction === 'money_in' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {adj.direction === 'money_in' ? '+' : '-'}৳{adj.amount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-300 capitalize text-[11px]">
                          {adj.reason_category.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-300 max-w-xs truncate" title={adj.reason_notes}>
                          <span>{adj.reason_notes}</span>
                          {adj.reference && <span className="text-zinc-500 ml-1 font-mono text-[10px]">(Ref: {adj.reference})</span>}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 text-[11px]">{adj.offset_account_name}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-400">{adj.journal_entry_id}</td>
                        <td className="py-2.5 px-3 text-center">
                          {adj.status === 'posted' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/50 text-emerald-300 border border-emerald-800">
                              <Check className="w-3 h-3" /> Posted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700" title={`Voided by ${adj.voided_by_name}: ${adj.void_reason}`}>
                              <Ban className="w-3 h-3 text-rose-400" /> Voided
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 text-[11px]">{adj.created_by_name}</td>
                        {isFinanceAdmin && (
                          <td className="py-2.5 px-3 text-right">
                            {adj.status === 'posted' && (
                              <button
                                onClick={() => handleOpenVoidModal(adj)}
                                className="px-2 py-1 bg-zinc-800 hover:bg-rose-950/80 hover:text-rose-300 text-zinc-400 rounded text-[11px] font-medium transition inline-flex items-center gap-1"
                                title="Void and reverse this adjustment journal"
                              >
                                <RotateCcw className="w-3 h-3" /> Void
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3 / DRAWER: ACCOUNT BOOK / STATEMENT VIEW */}
      {selectedStatementAccountId && (
        <div className="space-y-4">
          {/* Statement Account Header */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-zinc-100">
                    {statementData?.account.account_name}
                  </h3>
                  {statementData?.account && renderAccountTypeBadge(statementData.account.account_type)}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-3 font-mono text-[11px]">
                  <span>Account #: {statementData?.account.account_number}</span>
                  {statementData?.account.bank_name && (
                    <span>• Bank: {statementData.account.bank_name} ({statementData.account.branch_name})</span>
                  )}
                  <span>• General Ledger COA: {statementData?.account.linked_chart_account_code} - {statementData?.account.linked_chart_account_name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedStatementAccountId(null)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-medium transition"
                >
                  Back to Accounts
                </button>
              </div>
            </div>

            {/* Statement KPI Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80">
                <div className="text-[10px] text-zinc-500 font-medium">Opening Balance</div>
                <div className="text-sm font-semibold text-zinc-300 mt-0.5 tabular-nums">
                  ৳{(statementData?.opening_balance || 0).toLocaleString()}
                </div>
              </div>

              <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80">
                <div className="text-[10px] text-zinc-500 font-medium">Total Inflow (Debit +)</div>
                <div className="text-sm font-semibold text-emerald-400 mt-0.5 tabular-nums">
                  +৳{(statementData?.total_inflow || 0).toLocaleString()}
                </div>
              </div>

              <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80">
                <div className="text-[10px] text-zinc-500 font-medium">Total Outflow (Credit -)</div>
                <div className="text-sm font-semibold text-rose-400 mt-0.5 tabular-nums">
                  -৳{(statementData?.total_outflow || 0).toLocaleString()}
                </div>
              </div>

              <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80">
                <div className="text-[10px] text-zinc-500 font-medium">Current Closing Balance</div>
                <div className="text-sm font-semibold text-zinc-100 mt-0.5 tabular-nums">
                  ৳{(statementData?.closing_balance || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Statement Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <Calendar className="w-3.5 h-3.5" />
                <span>From:</span>
                <input
                  type="date"
                  value={statementStartDate}
                  onChange={(e) => setStatementStartDate(e.target.value)}
                  className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-zinc-300 text-xs"
                />
                <span>To:</span>
                <input
                  type="date"
                  value={statementEndDate}
                  onChange={(e) => setStatementEndDate(e.target.value)}
                  className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-zinc-300 text-xs"
                />
              </div>

              <select
                value={statementTypeFilter}
                onChange={(e) => setStatementTypeFilter(e.target.value)}
                className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded text-zinc-300 text-xs"
              >
                <option value="all">All Transaction Types</option>
                <option value="pos_sale">POS / Sales</option>
                <option value="expense">Expenses</option>
                <option value="payroll">Payroll</option>
                <option value="fund_transfer_in">Transfer In</option>
                <option value="fund_transfer_out">Transfer Out</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
                <option value="supplier_payment">Supplier Payments</option>
                <option value="courier_settlement">Courier Settlements</option>
                <option value="cashier_closing">Cashier Closings</option>
              </select>

              {(statementStartDate || statementEndDate || statementTypeFilter !== 'all') && (
                <button
                  onClick={() => {
                    setStatementStartDate('');
                    setStatementEndDate('');
                    setStatementTypeFilter('all');
                  }}
                  className="px-2 py-1 text-zinc-400 hover:text-white text-[11px] underline"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="text-zinc-500 text-[11px]">
              {filteredStatementItems.length} transactions recorded
            </div>
          </div>

          {/* Statement Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            {loadingStatement ? (
              <div className="py-12 text-center text-zinc-500 text-xs">Loading account statement...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-medium">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Reference #</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Money In (Debit)</th>
                      <th className="py-2 px-3 text-right">Money Out (Credit)</th>
                      <th className="py-2 px-3 text-right">Running Balance</th>
                      <th className="py-2 px-3">Journal Entry</th>
                      <th className="py-2 px-3">Created By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                    {filteredStatementItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-zinc-500 text-xs font-sans">
                          No transactions found in this date range.
                        </td>
                      </tr>
                    ) : (
                      filteredStatementItems.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-800/40 transition">
                          <td className="py-2 px-3 text-zinc-300">{item.date}</td>
                          <td className="py-2 px-3 font-semibold text-zinc-100">{item.reference}</td>
                          <td className="py-2 px-3 font-sans">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {item.transaction_type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans text-zinc-300 max-w-xs truncate" title={item.description}>
                            {item.description}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-400 font-semibold tabular-nums">
                            {item.money_in > 0 ? `+৳${item.money_in.toLocaleString()}` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-rose-400 font-semibold tabular-nums">
                            {item.money_out > 0 ? `-৳${item.money_out.toLocaleString()}` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-zinc-100 tabular-nums">
                            ৳{item.running_balance.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-zinc-500 text-[10px]">{item.entry_number}</td>
                          <td className="py-2 px-3 font-sans text-zinc-400 text-[11px]">{item.created_by_name}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT PAYMENT ACCOUNT */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-lg w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <h3 className="text-sm font-semibold text-zinc-100">
                {editingAccount ? 'Edit Payment Account' : 'Add New Payment Account'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:text-white text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="px-2.5 py-1.5 bg-rose-950/50 border border-rose-800 text-rose-300 rounded text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleSaveAccount} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Account Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. BRAC Bank Corporate / Shop Cash Till 2"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Account Type</label>
                  <select
                    disabled={Boolean(editingAccount)}
                    value={formType}
                    onChange={(e) => {
                      const t = e.target.value as PaymentAccountType;
                      setFormType(t);
                      if (t === 'cash') setFormLinkedCoaId('acc_cash');
                      else if (t === 'bank') setFormLinkedCoaId('acc_bank');
                      else if (t === 'bkash') setFormLinkedCoaId('acc_bkash');
                      else if (t === 'nagad') setFormLinkedCoaId('acc_nagad');
                    }}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700 disabled:opacity-50"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="cash">Cash Register / Till</option>
                    <option value="petty_cash">Petty Cash Drawer</option>
                    <option value="bkash">bKash Merchant / Personal</option>
                    <option value="nagad">Nagad Wallet</option>
                    <option value="other">Other Wallet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Account Number / Mobile Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formNumber}
                    onChange={(e) => setFormNumber(e.target.value)}
                    placeholder="e.g. 110-234-5678901 / 01711000001"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  />
                </div>

                {formType === 'bank' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={formBankName}
                        onChange={(e) => setFormBankName(e.target.value)}
                        placeholder="e.g. City Bank Ltd."
                        className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Branch Name</label>
                      <input
                        type="text"
                        value={formBranchName}
                        onChange={(e) => setFormBranchName(e.target.value)}
                        placeholder="e.g. Banani Branch"
                        className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Linked General Ledger Account</label>
                  <select
                    value={formLinkedCoaId}
                    onChange={(e) => setFormLinkedCoaId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  >
                    {accounts
                      .filter((a) => a.type === 'asset')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                  </select>
                </div>

                {!editingAccount && (
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Initial Opening Balance (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formOpeningBal}
                      onChange={(e) => setFormOpeningBal(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Default Role Assignments</label>
                  <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-2.5 rounded border border-zinc-800 text-[11px]">
                    <label className="flex items-center gap-2 text-zinc-300">
                      <input
                        type="checkbox"
                        checked={formIsDefaultPos}
                        onChange={(e) => setFormIsDefaultPos(e.target.checked)}
                        className="rounded border-zinc-700 text-emerald-600"
                      />
                      <span>Default for Walk-In POS</span>
                    </label>
                    <label className="flex items-center gap-2 text-zinc-300">
                      <input
                        type="checkbox"
                        checked={formIsDefaultCourier}
                        onChange={(e) => setFormIsDefaultCourier(e.target.checked)}
                        className="rounded border-zinc-700 text-blue-600"
                      />
                      <span>Default for Courier Settlement</span>
                    </label>
                    <label className="flex items-center gap-2 text-zinc-300">
                      <input
                        type="checkbox"
                        checked={formIsDefaultPayroll}
                        onChange={(e) => setFormIsDefaultPayroll(e.target.checked)}
                        className="rounded border-zinc-700 text-purple-600"
                      />
                      <span>Default for Payroll Disbursal</span>
                    </label>
                    <label className="flex items-center gap-2 text-zinc-300">
                      <input
                        type="checkbox"
                        checked={formIsDefaultExpense}
                        onChange={(e) => setFormIsDefaultExpense(e.target.checked)}
                        className="rounded border-zinc-700 text-amber-600"
                      />
                      <span>Default for Petty Cash Expenses</span>
                    </label>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Notes / Description</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Operational notes, authorized signers, or purpose"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingAccount ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FUND TRANSFER */}
      {/* ========================================================================= */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Internal Fund Transfer</h3>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="p-1 hover:text-white text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="px-2.5 py-1.5 bg-rose-950/50 border border-rose-800 text-rose-300 rounded text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleExecuteTransfer} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  From Source Account (Credit Out) <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={transferFromId}
                  onChange={(e) => setTransferFromId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700 font-mono text-[11px]"
                >
                  {paymentAccounts
                    .filter((a) => a.is_active)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} (Balance: ৳{a.current_balance.toLocaleString()})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  To Destination Account (Debit In) <span className="text-emerald-400">*</span>
                </label>
                <select
                  required
                  value={transferToId}
                  onChange={(e) => setTransferToId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700 font-mono text-[11px]"
                >
                  {paymentAccounts
                    .filter((a) => a.is_active && a.id !== transferFromId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} (Balance: ৳{a.current_balance.toLocaleString()})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Transfer Amount (৳) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 font-semibold text-xs focus:outline-none focus:border-zinc-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Transfer Date</label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Transfer Fee / Charge (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={transferFee}
                    onChange={(e) => setTransferFee(e.target.value)}
                    placeholder="0 (e.g. bKash cashout fee)"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Reference / Slip #</label>
                  <input
                    type="text"
                    value={transferRef}
                    onChange={(e) => setTransferRef(e.target.value)}
                    placeholder="e.g. TrxID / Deposit Slip"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Purpose / Notes</label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Daily cash collection deposit to City Bank"
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>

              {/* Double-Entry Preview */}
              <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 text-[11px] space-y-1">
                <div className="text-zinc-400 font-medium">Double-Entry Journal Posting Preview:</div>
                <div className="text-emerald-400">
                  • Debit: Destination Account (Asset +৳{Number(transferAmount || 0).toLocaleString()})
                </div>
                {Number(transferFee) > 0 && (
                  <div className="text-amber-400">
                    • Debit: Bank Fees & Gateway Charges (Expense +৳{Number(transferFee).toLocaleString()})
                  </div>
                )}
                <div className="text-rose-400">
                  • Credit: Source Account (Asset -৳
                  {(Number(transferAmount || 0) + Number(transferFee || 0)).toLocaleString()})
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DEPOSIT */}
      {/* ========================================================================= */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Direct Account Deposit</h3>
              </div>
              <button onClick={() => setShowDepositModal(false)} className="p-1 hover:text-white text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="px-2.5 py-1.5 bg-rose-950/50 border border-rose-800 text-rose-300 rounded text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleExecuteDeposit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Destination Account (Debit In) <span className="text-emerald-400">*</span>
                </label>
                <select
                  required
                  value={depositAccountId}
                  onChange={(e) => setDepositAccountId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                >
                  {paymentAccounts
                    .filter((a) => a.is_active)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} ({a.account_type}) - Balance: ৳{a.current_balance.toLocaleString()}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Deposit Amount (৳) <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 font-semibold text-xs focus:outline-none focus:border-zinc-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Deposit Date</label>
                  <input
                    type="date"
                    required
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Deposit Source / Offset</label>
                <select
                  value={depositSourceType}
                  onChange={(e: any) => setDepositSourceType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                >
                  <option value="capital_injection">Owner Capital Injection (Credit 3010 Owner Equity)</option>
                  <option value="bank_interest">Bank Interest Received (Credit 4090 Other Income)</option>
                  <option value="other_income">Other Miscellaneous Income (Credit 4090)</option>
                  <option value="customer_advance">Customer Advance / Suspense (Credit 4010)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Reference / Slip #</label>
                <input
                  type="text"
                  value={depositRef}
                  onChange={(e) => setDepositRef(e.target.value)}
                  placeholder="e.g. Cheque # / Deposit Slip #"
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  placeholder="e.g. Additional working capital injection from owner"
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Record Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: WITHDRAWAL */}
      {/* ========================================================================= */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Direct Account Withdrawal</h3>
              </div>
              <button onClick={() => setShowWithdrawModal(false)} className="p-1 hover:text-white text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="px-2.5 py-1.5 bg-rose-950/50 border border-rose-800 text-rose-300 rounded text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleExecuteWithdraw} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Source Payment Account (Credit Out) <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={withdrawAccountId}
                  onChange={(e) => setWithdrawAccountId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                >
                  {paymentAccounts
                    .filter((a) => a.is_active)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} ({a.account_type}) - Balance: ৳{a.current_balance.toLocaleString()}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Withdrawal Amount (৳) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 font-semibold text-xs focus:outline-none focus:border-zinc-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Withdrawal Date</label>
                  <input
                    type="date"
                    required
                    value={withdrawDate}
                    onChange={(e) => setWithdrawDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Withdrawal Reason / Offset</label>
                <select
                  value={withdrawReasonType}
                  onChange={(e: any) => setWithdrawReasonType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                >
                  <option value="owner_drawings">Owner Personal Drawings (Debit 3020 Owner Drawings)</option>
                  <option value="bank_charge">Bank Fees & Annual Charges (Debit 6110)</option>
                  <option value="other_expense">Office & Incidental Expenses (Debit 6090)</option>
                  <option value="external_withdrawal">External Non-Expense Withdrawal</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Reference / Cheque #</label>
                <input
                  type="text"
                  value={withdrawRef}
                  onChange={(e) => setWithdrawRef(e.target.value)}
                  placeholder="e.g. Cheque # / ATM Reference"
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="e.g. Owner profit withdrawal"
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Record Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: MANUAL FINANCIAL ADJUSTMENT & EXCEPTION (PHASE 2) */}
      {/* ========================================================================= */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-lg w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Manual Financial Adjustment</h3>
              </div>
              <button onClick={() => setShowAdjustmentModal(false)} className="p-1 hover:text-white text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="px-2.5 py-1.5 bg-rose-950/50 border border-rose-800 text-rose-300 rounded text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleExecuteAdjustment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Target Payment Account <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={adjustAccountId}
                    onChange={(e) => setAdjustAccountId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  >
                    {paymentAccounts
                      .filter((a) => a.is_active)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.account_name} ({a.account_type}) — Balance: ৳{a.current_balance.toLocaleString()}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Adjustment Direction <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={adjustDirection}
                    onChange={(e: any) => setAdjustDirection(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  >
                    <option value="money_in">Money In / Debit Increase (+)</option>
                    <option value="money_out">Money Out / Credit Decrease (-)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Adjustment Amount (৳) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 font-semibold text-xs focus:outline-none focus:border-zinc-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Adjustment Date</label>
                  <input
                    type="date"
                    required
                    value={adjustDate}
                    onChange={(e) => setAdjustDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Reason Category <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={adjustReasonCategory}
                    onChange={(e: any) => {
                      const cat = e.target.value;
                      setAdjustReasonCategory(cat);
                      if (cat === 'unrecorded_pos_collection') setAdjustOffsetAccountId('acc_sales_revenue');
                      else if (cat === 'unrecorded_expense' || cat === 'bank_charge_adjustment') setAdjustOffsetAccountId('acc_bank_charges');
                      else if (cat === 'cash_shortage_correction') setAdjustOffsetAccountId('acc_cash_shortage');
                      else if (cat === 'cash_overage_correction') setAdjustOffsetAccountId('acc_cash_overage');
                      else if (cat === 'opening_balance_correction') setAdjustOffsetAccountId('acc_equity');
                      else setAdjustOffsetAccountId('acc_gain_loss_adj');
                    }}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  >
                    <option value="gateway_sync_correction">Gateway / Mobile Sync Discrepancy</option>
                    <option value="unrecorded_pos_collection">Unrecorded Customer Payment / POS Collection</option>
                    <option value="unrecorded_expense">Unrecorded Cash / Direct Expense</option>
                    <option value="bank_charge_adjustment">Unrecorded Bank Fee / Charge</option>
                    <option value="cash_shortage_correction">Physical Cash Till Shortage</option>
                    <option value="cash_overage_correction">Physical Cash Till Overage</option>
                    <option value="opening_balance_correction">Opening Balance Correction</option>
                    <option value="historical_audit_correction">Historical Audit Correction</option>
                    <option value="other_correction">Other Manual Financial Exception</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Offset General Ledger COA Account <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={adjustOffsetAccountId}
                    onChange={(e) => setAdjustOffsetAccountId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Audit Explanation / Notes <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={adjustReasonNotes}
                    onChange={(e) => setAdjustReasonNotes(e.target.value)}
                    placeholder="Specific operational reason for this adjustment..."
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    External Reference / Ticket / Bank Statement ID
                  </label>
                  <input
                    type="text"
                    value={adjustReference}
                    onChange={(e) => setAdjustReference(e.target.value)}
                    placeholder="e.g. bKash TrxID # / Bank Slip Ref"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Post Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: VOID ADJUSTMENT */}
      {/* ========================================================================= */}
      {showVoidModal && voidTargetAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Void Financial Adjustment</h3>
              </div>
              <button onClick={() => setShowVoidModal(false)} className="p-1 hover:text-white text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="px-2.5 py-1.5 bg-rose-950/50 border border-rose-800 text-rose-300 rounded text-xs">
                {actionError}
              </div>
            )}

            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 space-y-1">
              <div className="text-zinc-300 font-semibold">{voidTargetAdjustment.adjustment_number}</div>
              <div className="text-zinc-400 text-[11px]">
                Account: <span className="text-zinc-200">{voidTargetAdjustment.payment_account_name}</span>
              </div>
              <div className="text-zinc-400 text-[11px]">
                Amount:{' '}
                <span className={voidTargetAdjustment.direction === 'money_in' ? 'text-emerald-400' : 'text-rose-400'}>
                  {voidTargetAdjustment.direction === 'money_in' ? '+' : '-'}৳{voidTargetAdjustment.amount.toLocaleString()}
                </span>
              </div>
              <div className="text-zinc-400 text-[11px]">
                Original Note: <span className="text-zinc-300">{voidTargetAdjustment.reason_notes}</span>
              </div>
            </div>

            <form onSubmit={handleExecuteVoid} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Reason for Voiding / Reversal <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={voidReasonText}
                  onChange={(e) => setVoidReasonText(e.target.value)}
                  placeholder="e.g. Duplicate entry posted in error / reconciled by bank statement"
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowVoidModal(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Voiding...' : 'Confirm Void & Post Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
