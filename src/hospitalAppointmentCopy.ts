export interface HospitalAppointmentCopy {
  journeyLabel: string;
  journeyPrompt: string;
  demoLabel: string;
  preferenceTitle: string;
  preferenceDesc: string;
  date: string;
  startTime: string;
  endTime: string;
  onlyMatching: string;
  matchCount: string;
  matchBadge: string;
  mismatchBadge: string;
  walkInBadge: string;
  requiredBadge: string;
  optionalBadge: string;
  noMatchedHospitals: string;
  bookingTitle: string;
  slotsTitle: string;
  slotHelp: string;
  noMatchingSlot: string;
  alternatives: string;
  book: string;
  confirmed: string;
  bookingNumber: string;
  cancelBooking: string;
  continueWithoutBooking: string;
  continueWalkIn: string;
  requiredNotice: string;
  completeFirst: string;
  chatTitle: string;
  chatHelp: string;
  chatPreferenceUpdated: string;
  chatSlotsReady: string;
  chatNoMatch: string;
  chatChooseSlot: string;
  chatBooked: string;
  chatWalkIn: string;
  chatRequiredCannotSkip: string;
  chatSkipConfirmed: string;
  chatOpenHospitals: string;
  chatNeedChoice: string;
}

const copies: Record<string, HospitalAppointmentCopy> = {
  en: {
    journeyLabel: "Check appointment",
    journeyPrompt: "Hospital selected. Enter when you can visit, then confirm whether a matching appointment is available.",
    demoLabel: "Demo appointment data",
    preferenceTitle: "When can you visit?",
    preferenceDesc: "Hospitals are matched only when a mock appointment slot falls inside your available window.",
    date: "Available date",
    startTime: "From",
    endTime: "Until",
    onlyMatching: "Show only hospitals matching my time",
    matchCount: "{count} hospitals match",
    matchBadge: "Available in my time",
    mismatchBadge: "Bookable, but time does not match",
    walkInBadge: "Walk-in only",
    requiredBadge: "Appointment required",
    optionalBadge: "Appointment optional",
    noMatchedHospitals: "No hospital has an appointment inside this time. Change the date or time window.",
    bookingTitle: "Book the selected hospital",
    slotsTitle: "Matching appointment times",
    slotHelp: "Only slots inside your available window can be booked.",
    noMatchingSlot: "This hospital has no appointment inside your available window.",
    alternatives: "Other mock availability",
    book: "Confirm appointment",
    confirmed: "Appointment confirmed",
    bookingNumber: "Booking number {id}",
    cancelBooking: "Cancel appointment",
    continueWithoutBooking: "Continue without an appointment",
    continueWalkIn: "Continue with walk-in registration",
    requiredNotice: "This mock hospital requires an appointment. Choose a matching slot or another hospital.",
    completeFirst: "Complete appointment check first",
    chatTitle: "Book in chat",
    chatHelp: "Tell me when you can visit, for example: “tomorrow from 2 to 4 pm.”",
    chatPreferenceUpdated: "I set your available time to {date}, {start}–{end}.",
    chatSlotsReady: "{count} matching appointment times are available. Choose one below or tell me the time.",
    chatNoMatch: "There is no matching appointment in that window. Change the time or view other hospitals.",
    chatChooseSlot: "Choose an appointment time",
    chatBooked: "Your appointment at {hospital} is confirmed for {date} at {time}.",
    chatWalkIn: "This hospital accepts walk-ins only. You can continue without choosing a time.",
    chatRequiredCannotSkip: "This hospital requires an appointment, so you need to choose a matching time or another hospital.",
    chatSkipConfirmed: "Okay. We’ll continue without an appointment.",
    chatOpenHospitals: "View hospital appointments",
    chatNeedChoice: "Please choose one of the available times or tell me a specific time, such as “the second one” or “2 pm.”",
  },
  "zh-CN": {
    journeyLabel: "确认预约",
    journeyPrompt: "医院已选择。请输入您可以去医院的时间，并确认是否有匹配的预约时段。",
    demoLabel: "演示用预约信息",
    preferenceTitle: "您什么时候可以去医院？",
    preferenceDesc: "只有预约时段落在您的可用时间内，才会显示为时间匹配。",
    date: "可就诊日期",
    startTime: "开始时间",
    endTime: "结束时间",
    onlyMatching: "只看符合我时间的医院",
    matchCount: "{count} 家医院时间匹配",
    matchBadge: "我的时间内可预约",
    mismatchBadge: "可预约，但时间不匹配",
    walkInBadge: "仅现场挂号",
    requiredBadge: "必须预约",
    optionalBadge: "可选预约",
    noMatchedHospitals: "这个时间段没有可预约医院，请修改日期或时间。",
    bookingTitle: "预约所选医院",
    slotsTitle: "符合条件的预约时间",
    slotHelp: "只能预约您可用时间范围内的时段。",
    noMatchingSlot: "这家医院没有符合您可用时间的预约时段。",
    alternatives: "其他演示可预约时间",
    book: "确认预约",
    confirmed: "预约成功",
    bookingNumber: "预约编号 {id}",
    cancelBooking: "取消预约",
    continueWithoutBooking: "不预约，继续",
    continueWalkIn: "现场挂号并继续",
    requiredNotice: "该演示医院必须预约，请选择符合的时间或其他医院。",
    completeFirst: "请先确认预约方式",
    chatTitle: "在聊天中预约",
    chatHelp: "请告诉我您可以去医院的时间，例如：“明天下午2点到4点”。",
    chatPreferenceUpdated: "已将您的可用时间设为 {date} {start}–{end}。",
    chatSlotsReady: "有 {count} 个符合条件的预约时段。请在下方选择，或直接告诉我时间。",
    chatNoMatch: "这个时间段没有符合条件的预约。请修改时间或查看其他医院。",
    chatChooseSlot: "选择预约时间",
    chatBooked: "已确认您在 {date} {time} 前往 {hospital} 的预约。",
    chatWalkIn: "这家医院只提供现场挂号，您可以不选时间直接继续。",
    chatRequiredCannotSkip: "这家医院必须预约，请选择符合的时间或其他医院。",
    chatSkipConfirmed: "好的，将不预约并继续。",
    chatOpenHospitals: "查看医院预约",
    chatNeedChoice: "请选择一个可预约时段，或告诉我具体时间，例如“第二个”或“下午2点”。",
  },
  ko: {
    journeyLabel: "예약 확인",
    journeyPrompt: "병원을 선택했습니다. 방문 가능한 날짜와 시간을 입력하고 맞는 예약 시간이 있는지 확인해 주세요.",
    demoLabel: "시연용 예약 정보",
    preferenceTitle: "병원에 갈 수 있는 시간을 알려주세요",
    preferenceDesc: "사용자가 가능한 시간 안에 목업 예약 슬롯이 있을 때만 시간 일치로 표시합니다.",
    date: "가능한 날짜",
    startTime: "시작 시간",
    endTime: "종료 시간",
    onlyMatching: "내 시간에 예약 가능한 병원만 보기",
    matchCount: "시간이 맞는 병원 {count}곳",
    matchBadge: "내 시간에 예약 가능",
    mismatchBadge: "예약 가능 · 시간 불일치",
    walkInBadge: "현장 접수만 가능",
    requiredBadge: "예약 필수",
    optionalBadge: "예약 선택",
    noMatchedHospitals: "이 시간 안에 예약 가능한 병원이 없습니다. 날짜나 시간 범위를 변경해 주세요.",
    bookingTitle: "선택한 병원 예약",
    slotsTitle: "내 시간과 맞는 예약 시간",
    slotHelp: "입력한 가능 시간 안의 슬롯만 예약할 수 있습니다.",
    noMatchingSlot: "이 병원은 사용 가능한 시간과 맞는 예약 슬롯이 없습니다.",
    alternatives: "다른 시연용 예약 가능 시간",
    book: "예약 확정",
    confirmed: "예약이 확정되었습니다",
    bookingNumber: "예약번호 {id}",
    cancelBooking: "예약 취소",
    continueWithoutBooking: "예약 없이 계속",
    continueWalkIn: "현장 접수로 계속",
    requiredNotice: "이 목업 병원은 예약 필수입니다. 시간이 맞는 슬롯을 선택하거나 다른 병원을 골라주세요.",
    completeFirst: "예약 여부를 먼저 확인하세요",
    chatTitle: "채팅으로 예약",
    chatHelp: "“내일 오후 2시부터 4시 가능해”처럼 방문 가능한 시간을 알려주세요.",
    chatPreferenceUpdated: "방문 가능 시간을 {date} {start}~{end}로 설정했습니다.",
    chatSlotsReady: "조건에 맞는 예약 시간이 {count}개 있습니다. 아래에서 고르거나 원하는 시간을 말해 주세요.",
    chatNoMatch: "이 시간에는 맞는 예약이 없습니다. 시간을 바꾸거나 다른 병원의 예약을 확인해 주세요.",
    chatChooseSlot: "예약 시간 선택",
    chatBooked: "{hospital} 예약을 {date} {time}로 확정했습니다.",
    chatWalkIn: "이 병원은 현장 접수만 가능합니다. 시간을 선택하지 않고 계속할 수 있습니다.",
    chatRequiredCannotSkip: "이 병원은 예약이 필수입니다. 맞는 시간을 선택하거나 다른 병원을 골라주세요.",
    chatSkipConfirmed: "알겠습니다. 예약 없이 다음 단계로 진행할게요.",
    chatOpenHospitals: "병원 예약 화면 보기",
    chatNeedChoice: "가능한 시간 중 하나를 선택하거나 “두 번째 시간”, “오후 2시”처럼 구체적으로 말해 주세요.",
  },
};

export function hospitalAppointmentCopy(locale: string): HospitalAppointmentCopy {
  return copies[locale] || copies.en;
}
