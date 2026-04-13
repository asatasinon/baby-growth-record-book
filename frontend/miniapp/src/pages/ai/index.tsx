import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'

import { queryAi } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { AiAnswer } from '@/types/domain'
import { formatDateTime } from '@/utils/time'

import './index.scss'

const RECOMMENDED_QUESTIONS = [
  '最近 7 天平均每天喂多少 ml？',
  '最近宝宝睡眠是否稳定？',
  '这周排泄次数有没有明显变化？'
]

export default function AiPage() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<AiAnswer | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function submitQuery(nextQuestion?: string): Promise<void> {
    const finalQuestion = (nextQuestion ?? question).trim()
    if (!finalQuestion) {
      Taro.showToast({ title: '请输入问题', icon: 'none' })
      return
    }

    const session = getSession()
    const familyId = getActiveFamilyId(session || undefined)
    const babyId = getActiveBabyId()

    if (!session || !familyId || !babyId) {
      Taro.showToast({ title: '请先登录并选择宝宝', icon: 'none' })
      return
    }

    setIsLoading(true)
    try {
      const answer = await queryAi({
        session,
        familyId,
        babyId,
        question: finalQuestion
      })
      setResult(answer)
      setQuestion(finalQuestion)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || 'AI 查询失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }

  useDidShow(() => {
    setResult(null)
  })

  const hasContext = Boolean(getSession() && getActiveFamilyId(getSession() || undefined) && getActiveBabyId())

  if (!hasContext) {
    return (
      <View className='page-shell ai-page'>
        <View className='card empty-card'>
          <Text className='muted'>请先在“我的”页面登录并选择宝宝，才能使用 AI 问答。</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='page-shell ai-page'>
      <Text className='section-title'>AI 助手</Text>

      <View className='card ask-card'>
        <View className='form-item'>
          <Text className='form-label'>输入问题</Text>
          <Input
            className='input'
            value={question}
            onInput={(event) => setQuestion(event.detail.value)}
            placeholder='例如：最近 7 天平均每天喂多少 ml？'
          />
        </View>
        <Button className='btn-primary' loading={isLoading} onClick={() => void submitQuery()}>
          立即分析
        </Button>
        <Text className='ask-tip'>基于当前宝宝记录智能分析，建议问题尽量具体。</Text>
      </View>

      <Text className='section-title'>推荐问题</Text>
      <View className='pill-row'>
        {RECOMMENDED_QUESTIONS.map((item) => (
          <View
            key={item}
            className='pill'
            onClick={() => {
              setQuestion(item)
              void submitQuery(item)
            }}
          >
            <Text>{item}</Text>
          </View>
        ))}
      </View>

      {result ? (
        <View className='card answer-card'>
          <Text className='answer-title'>结论</Text>
          <Text className='answer-body'>{result.answer}</Text>
          <Text className='muted'>
            统计区间：{formatDateTime(result.window_start)} 至 {formatDateTime(result.window_end)}
          </Text>
          <Text className='disclaimer'>{result.disclaimer}</Text>
        </View>
      ) : null}
    </View>
  )
}
