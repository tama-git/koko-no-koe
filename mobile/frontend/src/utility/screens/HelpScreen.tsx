import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Pressable } from 'react-native';

type Props = {
  token: string;
  onClose: () => void; // ユーティリティメニューに戻るための関数
};

// Q&Aのデータ
const FAQ_DATA = [
  {
    id: '1',
    question: '投稿に位置情報が付与されません',
    answer: 'スマホの位置情報設定（GPS）が許可されているか確認してください。また、端末の再起動もお試しください。',
  },
  {
    id: '2',
    question: '他のユーザーの投稿を非表示にしたいです',
    answer: '投稿の右側にあるメニューアイコン（...）から「非表示」を選択してください。',
  },
  {
    id: '3',
    question: '不適切な投稿・迷惑行為の通報',
    answer: '投稿の右側にあるメニューアイコン（...）から「通報」を選択してください。運営チームが内容を確認し、必要に応じて対応します。',
  },
  {
    id: '4',
    question: 'アカウントを削除したいです',
    answer: 'ユーティリティメニューの「退会」からアカウント削除が可能です。退会すると投稿データもすべて削除されますのでご注意ください。',
  },
  {
    id: '5',
    question: 'リアクションの取り消しはできますか？',
    answer: 'もう一度同じリアクションボタンをタップすると取り消すことができます。',
  },
];

// @ts-ignore
export function HelpScreen({ token, onClose }: Props) {
  const [openId, setOpenId] = useState(null);

  // @ts-ignore
  const toggleAccordion = (id) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー（戻るボタン） */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <Text style={styles.backText}>戻る</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>よくある質問</Text>

        {/* Q&Aのリスト表示 */}
        {FAQ_DATA.map((item) => {
          const isOpen = openId === item.id;
          return (
            <View key={item.id} style={styles.faqCard}>
              <TouchableOpacity
                style={styles.questionButton}
                onPress={() => toggleAccordion(item.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.questionText}>Q. {item.question}</Text>
                <Text style={styles.arrow}>{isOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.answerBox}>
                  <Text style={styles.answerText}>{item.answer}</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* 解決しなかった場合の案内 */}
        <View style={styles.contactSection}>
          <Text style={styles.contactNotice}>解決しない場合は今後お問い合わせ機能が追加されます</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    alignItems: 'flex-start' 
  },
  backButton: { 
    minHeight: 44, 
    justifyContent: 'center' 
  },
  backText: { 
    color: '#2C6049', 
    fontSize: 15, 
    fontWeight: '700' 
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  faqCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    overflow: 'hidden',
  },
  questionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
    flex: 1,
    paddingRight: 8,
  },
  arrow: {
    fontSize: 12,
    color: '#6c757d',
  },
  answerBox: {
    backgroundColor: '#f1f3f5',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  answerText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  contactSection: {
    marginTop: 32,
    alignItems: 'center',
    paddingBottom: 24,
  },
  contactNotice: {
    fontSize: 14,
    color: '#6c757d',
  },
});