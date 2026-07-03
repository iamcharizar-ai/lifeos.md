import { SkillTree } from '../components/SkillTree'
import type { SkillState, SkillStatus } from '../config/skills'

export function BodyScreen({
  skills,
  onSkill,
}: {
  skills: SkillState
  onSkill: (id: string, status: SkillStatus) => void
}) {
  return <SkillTree skills={skills} onSkill={onSkill} />
}
