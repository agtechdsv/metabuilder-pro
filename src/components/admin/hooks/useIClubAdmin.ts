import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { getIClubAdminRules, saveIClubAdminRule, deleteIClubAdminRule } from '@/app/actions/iclub'
import { IClubRule, getLocalizedIClubRuleName } from '@/lib/iclub'

export function useIClubAdmin(activeTab: string) {
  const { toast } = useToast()

  const [iclubRules, setIclubRules] = useState<IClubRule[]>([])
  const [isLoadingRules, setIsLoadingRules] = useState(false)
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Partial<IClubRule> | null>(null)

  const [ruleNamePt, setRuleNamePt] = useState('')
  const [ruleNameEn, setRuleNameEn] = useState('')
  const [ruleNameEs, setRuleNameEs] = useState('')

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

  const openNewRuleModal = () => {
    setEditingRule(null)
    setRuleNamePt('')
    setRuleNameEn('')
    setRuleNameEs('')
    setRuleBenefitType('referral_discount')
    setRuleTargetCount(1)
    setRuleRewardType('percent_discount')
    setRuleRewardValue(5)
    setRuleIsActive(true)
    setIsRuleModalOpen(true)
  }

  const openEditRuleModal = (rule: IClubRule) => {
    setEditingRule(rule)
    
    let pt = ''
    let en = ''
    let es = ''
    
    if (typeof rule.name === 'object' && rule.name !== null) {
      pt = rule.name.pt || ''
      en = rule.name.en || ''
      es = rule.name.es || ''
    } else if (typeof rule.name === 'string') {
      const trimmed = rule.name.trim()
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed)
          pt = parsed.pt || ''
          en = parsed.en || ''
          es = parsed.es || ''
        } catch {
          pt = rule.name
          en = rule.name
          es = rule.name
        }
      } else {
        pt = rule.name
        en = rule.name
        es = rule.name
      }
    }

    setRuleNamePt(pt)
    setRuleNameEn(en)
    setRuleNameEs(es)
    setRuleBenefitType(rule.benefit_type as any)
    setRuleTargetCount(rule.target_count)
    setRuleRewardType(rule.reward_type as any)
    setRuleRewardValue(Number(rule.reward_value))
    setRuleIsActive(rule.is_active)
    setIsRuleModalOpen(true)
  }

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleNamePt.trim() && !ruleNameEn.trim() && !ruleNameEs.trim()) {
      toast('Nome da regra em pelo menos um idioma é obrigatório', 'info')
      return
    }

    const defaultName = ruleNamePt.trim() || ruleNameEn.trim() || ruleNameEs.trim()
    const nameObject = {
      pt: ruleNamePt.trim() || defaultName,
      en: ruleNameEn.trim() || defaultName,
      es: ruleNameEs.trim() || defaultName,
    }

    setIsSavingRule(true)
    const result = await saveIClubAdminRule({
      id: editingRule?.id,
      name: nameObject,
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
      const localizedName = getLocalizedIClubRuleName(ruleToDelete.name, 'pt')
      toast(`Regra "${localizedName}" excluída com sucesso.`, 'success')
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
    ruleNamePt,
    setRuleNamePt,
    ruleNameEn,
    setRuleNameEn,
    ruleNameEs,
    setRuleNameEs,
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
    openNewRuleModal,
    openEditRuleModal,
    handleSaveRule,
    handleConfirmDeleteRule
  }
}
