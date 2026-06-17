import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { getIClubAdminRules, saveIClubAdminRule, deleteIClubAdminRule, IClubRule } from '@/app/actions/iclub'

export function useIClubAdmin(activeTab: string) {
  const { toast } = useToast()

  const [iclubRules, setIclubRules] = useState<IClubRule[]>([])
  const [isLoadingRules, setIsLoadingRules] = useState(false)
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Partial<IClubRule> | null>(null)

  const [ruleName, setRuleName] = useState('')
  const [ruleBenefitType, setRuleBenefitType] = useState<'volume_license' | 'referral_discount'>('referral_discount')
  const [ruleTargetCount, setRuleTargetCount] = useState(1)
  const [ruleRewardType, setRuleRewardType] = useState<'free_license' | 'percent_discount'>('percent_discount')
  const [ruleRewardValue, setRuleRewardValue] = useState(5)
  const [ruleIsActive, setRuleIsActive] = useState(true)
  const [isSavingRule, setIsSavingRule] = useState(false)

  const [isDeleteRuleModalOpen, setIsDeleteRuleModalOpen] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState<IClubRule | null>(null)
  const [isDeletingRule, setIsDeletingRule] = useState(false)

  const fetchIClubRules = async () => {
    setIsLoadingRules(true)
    const res = await getIClubAdminRules()
    if (res.success && res.rules) {
      setIclubRules(res.rules)
    } else {
      toast(res.error || 'Erro ao carregar regras do iClub.', 'error')
    }
    setIsLoadingRules(false)
  }

  useEffect(() => {
    if (activeTab === 'iclub') {
      fetchIClubRules()
    }
  }, [activeTab])

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleName) {
      toast('Nome da regra é obrigatório', 'info')
      return
    }

    setIsSavingRule(true)
    const result = await saveIClubAdminRule({
      id: editingRule?.id,
      name: ruleName,
      benefit_type: ruleBenefitType,
      target_count: ruleTargetCount,
      reward_type: ruleRewardType,
      reward_value: ruleRewardValue,
      is_active: ruleIsActive
    })
    setIsSavingRule(false)

    if (result.success) {
      toast(editingRule ? 'Regra atualizada com sucesso!' : 'Nova regra criada com sucesso!', 'success')
      setIsRuleModalOpen(false)
      fetchIClubRules()
    } else {
      toast(result.error || 'Erro ao salvar a regra', 'error')
    }
  }

  const handleConfirmDeleteRule = async () => {
    if (!ruleToDelete || !ruleToDelete.id) return
    setIsDeletingRule(true)
    const result = await deleteIClubAdminRule(ruleToDelete.id)
    setIsDeletingRule(false)
    if (result.success) {
      toast(`Regra "${ruleToDelete.name}" excluída com sucesso.`, 'success')
      setIsDeleteRuleModalOpen(false)
      setRuleToDelete(null)
      fetchIClubRules()
    } else {
      toast(result.error || 'Erro ao excluir a regra.', 'error')
    }
  }

  return {
    iclubRules,
    isLoadingRules,
    isRuleModalOpen,
    setIsRuleModalOpen,
    editingRule,
    setEditingRule,
    ruleName,
    setRuleName,
    ruleBenefitType,
    setRuleBenefitType,
    ruleTargetCount,
    setRuleTargetCount,
    ruleRewardType,
    setRuleRewardType,
    ruleRewardValue,
    setRuleRewardValue,
    ruleIsActive,
    setRuleIsActive,
    isSavingRule,
    isDeleteRuleModalOpen,
    setIsDeleteRuleModalOpen,
    ruleToDelete,
    setRuleToDelete,
    isDeletingRule,
    handleSaveRule,
    handleConfirmDeleteRule
  }
}
