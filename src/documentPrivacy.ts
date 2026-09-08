export function documentPrivacyCopy(locale: string) {
  if (locale.startsWith("ko")) return {
    consent: "이 문서와 질문을 OpenAI에 보내 OCR·번역·설명을 받는 데 동의합니다.",
    notice: "문서에는 이름·진료 정보 등 민감한 정보가 포함될 수 있습니다. 불필요한 개인정보는 가린 뒤 제출해 주세요.",
    retention: "기록 저장을 선택하지 않으면 NaruCare 서버에 파일과 결과를 보관하지 않습니다. OpenAI의 별도 데이터 보관 정책은 적용됩니다.",
    policy: "OpenAI 데이터 정책",
    details: "처리·보관 안내",
    save: "원본·인식한 원문·번역을 내 문서 기록에 저장 (선택)",
    temporary: "일회성 문서 · 새로고침하거나 로그아웃하면 사라집니다.",
    required: "AI 처리 동의를 확인해 주세요.",
    clear: "문서 닫기",
  };
  if (locale.startsWith("zh")) return {
    consent: "我同意将此文档及问题发送给 OpenAI，进行文字识别、翻译和解释。",
    notice: "文档可能包含姓名、诊疗信息等敏感信息。提交前请遮盖不必要的个人信息。",
    retention: "未选择保存记录时，NaruCare 不在服务器保留文件和结果。OpenAI 的数据保留政策仍适用。",
    policy: "OpenAI 数据政策",
    details: "处理与保留说明",
    save: "将原件、识别文本和译文保存到我的文档记录（可选）",
    temporary: "临时文档 · 刷新页面或退出登录后清除。",
    required: "请先确认同意 AI 处理。",
    clear: "关闭文档",
  };
  if (locale.startsWith("ja")) return {
    consent: "この文書と質問を OpenAI に送信し、文字認識・翻訳・説明を受けることに同意します。",
    notice: "文書には氏名や診療情報などの機密情報が含まれる場合があります。不要な個人情報を隠してから送信してください。",
    retention: "保存を選択しない場合、NaruCare はファイルと結果をサーバーに保存しません。OpenAI のデータ保持方針は別途適用されます。",
    policy: "OpenAI データ方針",
    details: "処理・保存について",
    save: "原本・認識したテキスト・訳文を文書履歴に保存する（任意）",
    temporary: "一時文書 · 再読み込みまたはログアウトで消去されます。",
    required: "AI 処理への同意を確認してください。",
    clear: "文書を閉じる",
  };
  return {
    consent: "I agree to send this document and my questions to OpenAI for text recognition, translation and explanation.",
    notice: "Documents may contain sensitive information such as names and medical details. Cover unnecessary personal information before submitting.",
    retention: "Unless you choose to save, NaruCare does not retain the file or results on its servers. OpenAI's separate data retention policy still applies.",
    policy: "OpenAI data policy",
    details: "Processing and retention details",
    save: "Save the original, recognized text and translation in my document history (optional)",
    temporary: "Temporary document · cleared when you refresh or sign out.",
    required: "Please confirm your consent to AI processing.",
    clear: "Close document",
  };
}
