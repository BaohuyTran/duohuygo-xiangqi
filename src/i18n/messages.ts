// The single source of all user-visible text, in English and Vietnamese side by side.
// Lesson JSON (src/content/lessons/) refers to these keys; the content validator checks they exist.
// Placeholders like {n} are filled in by t().

export const LANGUAGES = ['en', 'vi'] as const;
export type Language = (typeof LANGUAGES)[number];

type Entry = Record<Language, string>;

export const messages = {
  // ---------- App / home ----------
  'app.title': { en: 'DuoHuyGo Xiangqi', vi: 'DuoHuyGo Cờ Tướng' },
  'app.tagline': { en: 'Learn Chinese chess, one step at a time', vi: 'Học cờ tướng từng bước một' },
  'lang.label': { en: 'Language', vi: 'Ngôn ngữ' },
  'lang.en': { en: 'English', vi: 'Tiếng Anh' },
  'lang.vi': { en: 'Vietnamese', vi: 'Tiếng Việt' },
  'sound.turnOff': { en: 'Turn sound off', vi: 'Tắt âm thanh' },
  'sound.turnOn': { en: 'Turn sound on', vi: 'Bật âm thanh' },
  'home.unit': { en: 'Unit {n}', vi: 'Chương {n}' },
  'home.progress': { en: '{done} of {total} lessons complete', vi: 'Đã xong {done}/{total} bài' },
  'home.lessonState.locked': { en: 'locked', vi: 'chưa mở' },
  'home.lessonState.available': { en: 'start', vi: 'bắt đầu' },
  'home.lessonState.completed': { en: 'completed', vi: 'đã hoàn thành' },
  'home.start': { en: 'Start', vi: 'Bắt đầu' },
  'home.reset': { en: 'Reset progress', vi: 'Xóa tiến độ' },
  'home.resetConfirm': { en: 'Reset all lesson progress?', vi: 'Xóa toàn bộ tiến độ học?' },
  'track.basics.title': { en: 'Basics', vi: 'Cơ bản' },
  'track.basics.desc': { en: 'The board, every piece, check and checkmate.', vi: 'Bàn cờ, cách đi của từng quân, chiếu và chiếu bí.' },
  'track.intermediate.title': { en: 'Intermediate', vi: 'Trung cấp' },
  'track.intermediate.desc': {
    en: 'Classic mating patterns, tactics and combinations. Open from the start.',
    vi: 'Các thế sát cục kinh điển, chiến thuật và đòn phối hợp. Mở sẵn từ đầu.',
  },
  'track.advanced.title': { en: 'Advanced', vi: 'Nâng cao' },
  'track.advanced.desc': {
    en: 'Discovered attacks, decoys, mate in 3 and stopping a mate in 2.',
    vi: 'Đòn chiếu mở, đòn dụ, chiếu bí sau 3 nước và chặn đòn chiếu bí sau 2 nước.',
  },
  'track.expert.title': { en: 'Expert', vi: 'Chuyên gia' },
  'track.expert.desc': {
    en: 'Quiet moves, mate in 4 and only-move defence.',
    vi: 'Nước êm, chiếu bí sau 4 nước và phòng thủ bằng nước duy nhất.',
  },
  'track.master.title': { en: 'Master', vi: 'Kiện tướng' },
  'track.master.desc': {
    en: 'Full, realistic positions: long combinations and defending against mate in 3.',
    vi: 'Thế cờ đầy đủ như ván thật: đòn phối hợp dài và phòng thủ trước đòn chiếu bí sau 3 nước.',
  },
  // Home "jump to this level" banner, one pair per track after basics (see jumpBannerTrack).
  'track.intermediate.jumpTitle': { en: 'Already know the rules?', vi: 'Đã biết luật chơi?' },
  'track.intermediate.jumpBody': { en: 'Jump to the Intermediate course.', vi: 'Chuyển tới khóa Trung cấp.' },
  'track.advanced.jumpTitle': { en: 'Ready for more?', vi: 'Sẵn sàng thử thách hơn?' },
  'track.advanced.jumpBody': { en: 'Jump to the Advanced course.', vi: 'Chuyển tới khóa Nâng cao.' },
  'track.expert.jumpTitle': { en: 'Strong player already?', vi: 'Bạn đã chơi tốt?' },
  'track.expert.jumpBody': { en: 'Jump to the Expert course.', vi: 'Chuyển tới khóa Chuyên gia.' },
  'track.master.jumpTitle': { en: 'Looking for a real challenge?', vi: 'Muốn thử thách thật sự?' },
  'track.master.jumpBody': { en: 'Jump to the Master course.', vi: 'Chuyển tới khóa Kiện tướng.' },
  'jump.here': { en: 'Jump here', vi: 'Nhảy tới đây' },
  'jump.dialog.title': { en: 'Jump to “{lesson}”?', vi: 'Nhảy tới “{lesson}”?' },
  'jump.dialog.body': {
    en: 'Pass a short test ({questions} exercises) to unlock it. Lessons skipped: {skipped}. You have {lives} lives in the test; your hearts are not used.',
    vi: 'Vượt qua bài kiểm tra ngắn ({questions} câu) để mở bài này. Số bài được bỏ qua: {skipped}. Bạn có {lives} mạng trong bài kiểm tra; tim của bạn không bị trừ.',
  },
  'jump.start': { en: 'Start the test', vi: 'Bắt đầu kiểm tra' },
  'jump.cancel': { en: 'Not now', vi: 'Để sau' },
  'jump.title': { en: 'Jump-ahead test', vi: 'Bài kiểm tra nhảy cóc' },
  'jump.seeResult': { en: 'See result', vi: 'Xem kết quả' },
  'jump.failed.title': { en: 'Not this time', vi: 'Lần này chưa được' },
  'jump.failed.body': {
    en: 'You ran out of lives. Learn the lessons one by one, or try the test again later.',
    vi: 'Bạn đã hết mạng. Hãy học lần lượt từng bài, hoặc thử lại bài kiểm tra sau.',
  },
  'jump.back': { en: 'Back to lessons', vi: 'Quay lại bài học' },
  'jump.passed.title': { en: 'You skipped ahead!', vi: 'Bạn đã nhảy cóc thành công!' },
  'jump.passed.body': {
    en: '{correct} of {total} right on the first try. The lessons you skipped are marked complete.',
    vi: 'Đúng {correct}/{total} câu ngay lần đầu. Các bài bạn bỏ qua đã được đánh dấu hoàn thành.',
  },
  'home.allDone': { en: 'You finished every lesson. Great work!', vi: 'Bạn đã học xong tất cả các bài. Tuyệt vời!' },

  // ---------- Account + sync (only shown when Supabase is configured) ----------
  'account.open': { en: 'Account and sync', vi: 'Tài khoản và đồng bộ' },
  'account.title': { en: 'Account and sync', vi: 'Tài khoản và đồng bộ' },
  'account.close': { en: 'Close', vi: 'Đóng' },
  'account.intro': {
    en: 'Sign in with your email to keep your progress on all your devices. Everything also works without an account.',
    vi: 'Đăng nhập bằng email để giữ tiến độ trên mọi thiết bị. Không có tài khoản bạn vẫn dùng được đầy đủ.',
  },
  'account.email': { en: 'Email', vi: 'Email' },
  'account.sendLink': { en: 'Send magic link', vi: 'Gửi liên kết đăng nhập' },
  'account.sending': { en: 'Sending…', vi: 'Đang gửi…' },
  'account.sendFailed': {
    en: 'Couldn’t send the link. Check the address and your connection, then try again.',
    vi: 'Không gửi được liên kết. Hãy kiểm tra địa chỉ email và kết nối mạng rồi thử lại.',
  },
  'account.linkSent': {
    en: 'Check your inbox: we sent a sign-in link to {email}. Open it on this device.',
    vi: 'Hãy kiểm tra hộp thư: chúng tôi đã gửi liên kết đăng nhập tới {email}. Hãy mở nó trên thiết bị này.',
  },
  'account.useOtherEmail': { en: 'Use a different email', vi: 'Dùng email khác' },
  'account.loading': { en: 'Loading…', vi: 'Đang tải…' },
  'account.signedInAs': { en: 'Signed in as {email}', vi: 'Đã đăng nhập: {email}' },
  'account.logout': { en: 'Log out', vi: 'Đăng xuất' },
  'account.logoutNote': {
    en: 'Logging out keeps your progress on this device.',
    vi: 'Đăng xuất vẫn giữ tiến độ trên thiết bị này.',
  },
  'sync.idle': { en: 'Not synced yet', vi: 'Chưa đồng bộ' },
  'sync.syncing': { en: 'Syncing…', vi: 'Đang đồng bộ…' },
  'sync.synced': { en: 'Progress synced', vi: 'Đã đồng bộ tiến độ' },
  'sync.offline': {
    en: 'Offline. Your progress will sync when you are back online.',
    vi: 'Đang ngoại tuyến. Tiến độ sẽ được đồng bộ khi có mạng trở lại.',
  },
  'sync.error': {
    en: 'Couldn’t sync right now. Your progress is safe on this device.',
    vi: 'Chưa đồng bộ được. Tiến độ của bạn vẫn an toàn trên thiết bị này.',
  },

  // ---------- Lesson player ----------
  'lesson.quit': { en: 'Quit lesson', vi: 'Thoát bài học' },
  'lesson.progress': { en: 'Exercise {n} of {total}', vi: 'Bài tập {n}/{total}' },
  'lesson.continue': { en: 'Continue', vi: 'Tiếp tục' },
  'lesson.check': { en: 'Check', vi: 'Kiểm tra' },
  'lesson.retry': { en: 'Try again', vi: 'Thử lại' },
  'lesson.clear': { en: 'Clear', vi: 'Bỏ chọn' },
  'lesson.selected': { en: '{n} selected', vi: 'Đã chọn {n}' },
  'lesson.type.learn': { en: 'New idea', vi: 'Kiến thức mới' },
  'lesson.type.select-squares': { en: 'Tap the points', vi: 'Chạm vào các điểm' },
  'lesson.type.move': { en: 'Make a move', vi: 'Đi một nước' },
  'lesson.type.capture': { en: 'Find the capture', vi: 'Tìm nước ăn quân' },
  'lesson.type.combination': { en: 'Combination', vi: 'Đòn phối hợp' },
  'combination.movesLeft': { en: 'Red to move · moves left: {n}', vi: 'Đỏ đi · còn {n} nước' },
  'combination.opponent': { en: 'Black is answering…', vi: 'Đen đang trả lời…' },
  'combination.checking': { en: 'Checking your move…', vi: 'Đang kiểm tra nước đi…' },
  'combination.done': { en: 'Combination complete', vi: 'Hoàn thành đòn phối hợp' },
  'combination.hint': { en: 'Show a hint', vi: 'Xem gợi ý' },
  'combination.hintPiece': { en: 'Move the marked piece.', vi: 'Hãy đi quân được đánh dấu.' },
  'combination.wrong.mate': {
    en: 'That move lets Black escape. There is a forced mate: look for checks first.',
    vi: 'Nước đó để Đen thoát. Có một đòn chiếu bí bắt buộc: hãy tìm các nước chiếu trước.',
  },
  'combination.wrong.material': {
    en: 'That doesn’t win material against Black’s best defence.',
    vi: 'Nước đó không thắng quân trước cách phòng thủ tốt nhất của Đen.',
  },
  'lesson.tapPiece': { en: 'Tap a piece, then tap where it should go.', vi: 'Chạm vào một quân, rồi chạm vào điểm cần đến.' },
  'feedback.correct': { en: 'Correct!', vi: 'Chính xác!' },
  'feedback.incorrect': { en: 'Not quite', vi: 'Chưa đúng' },
  'verdict.illegal': { en: 'That piece can’t move there.', vi: 'Quân đó không thể đi tới điểm này.' },
  'verdict.unsafe': {
    en: 'That move would leave your General under attack.',
    vi: 'Nước đi đó khiến Tướng của bạn bị tấn công.',
  },
  'verdict.wrong-piece': { en: 'Move the highlighted piece.', vi: 'Hãy đi quân đang được đánh dấu.' },
  'verdict.wrong-target': {
    en: 'A legal move, but not to the marked point.',
    vi: 'Nước đi hợp lệ, nhưng chưa tới điểm được đánh dấu.',
  },
  'verdict.not-check': { en: 'That move doesn’t give check.', vi: 'Nước đi đó không chiếu Tướng.' },
  'verdict.not-checkmate': {
    en: 'Not checkmate: Black can still escape.',
    vi: 'Chưa chiếu bí: bên Đen vẫn còn đường thoát.',
  },
  'verdict.allows-mate': {
    en: 'After that move Black can checkmate you. Stop the threat!',
    vi: 'Sau nước đó Đen có thể chiếu bí bạn. Hãy chặn mối đe dọa!',
  },
  'verdict.not-capture': { en: 'That move doesn’t capture anything.', vi: 'Nước đi đó không ăn quân nào.' },
  'verdict.not-best': {
    en: 'That capture doesn’t win material. Look for a safe or bigger one.',
    vi: 'Nước ăn đó không có lợi. Hãy tìm nước ăn an toàn hoặc ăn được quân lớn hơn.',
  },
  'verdict.selection': {
    en: 'Some points are missing or wrong. Green rings show what you missed, red marks show wrong picks.',
    vi: 'Còn thiếu hoặc chọn sai. Vòng xanh là điểm bị thiếu, dấu đỏ là điểm chọn sai.',
  },
  'done.title': { en: 'Lesson complete!', vi: 'Hoàn thành bài học!' },
  'done.stats': {
    en: '{correct} of {total} exercises right on the first try',
    vi: 'Làm đúng ngay lần đầu {correct}/{total} bài tập',
  },

  // ---------- Board accessibility ----------
  'board.label': { en: 'Xiangqi board', vi: 'Bàn cờ tướng' },
  'board.empty': { en: 'empty point', vi: 'điểm trống' },
  'board.legal': { en: 'legal move', vi: 'nước đi hợp lệ' },
  'board.picked': { en: 'selected', vi: 'đã chọn' },
  'board.target': { en: 'target', vi: 'mục tiêu' },
  'color.red': { en: 'Red', vi: 'Đỏ' },
  'color.black': { en: 'Black', vi: 'Đen' },
  'piece.general': { en: 'General', vi: 'Tướng' },
  'piece.advisor': { en: 'Advisor', vi: 'Sĩ' },
  'piece.elephant': { en: 'Elephant', vi: 'Tượng' },
  'piece.horse': { en: 'Horse', vi: 'Mã' },
  'piece.chariot': { en: 'Chariot', vi: 'Xe' },
  'piece.cannon': { en: 'Cannon', vi: 'Pháo' },
  'piece.soldier': { en: 'Soldier', vi: 'Tốt' },

  // ---------- Navigation ----------
  'nav.label': { en: 'Main sections', vi: 'Mục chính' },
  'nav.lessons': { en: 'Lessons', vi: 'Bài học' },
  'nav.puzzles': { en: 'Puzzles', vi: 'Câu đố' },

  // ---------- XP, hearts, daily goal, streak ----------
  'stats.label': { en: 'Your stats', vi: 'Thành tích của bạn' },
  'stats.streak': { en: '{n}-day streak', vi: 'Chuỗi {n} ngày' },
  'stats.todayXp': { en: 'Today: {xp} of {goal} XP', vi: 'Hôm nay: {xp}/{goal} XP' },
  'stats.xpShort': { en: '{xp}/{goal} XP', vi: '{xp}/{goal} XP' },
  'stats.hearts': { en: '{n} of {max} hearts', vi: '{n}/{max} tim' },
  'stats.nextHeart': { en: 'Next heart in {min} min', vi: 'Tim tiếp theo sau {min} phút' },
  'stats.goalMet': { en: 'Daily goal reached!', vi: 'Đã đạt mục tiêu hôm nay!' },
  'stats.bestStreak': { en: 'Best streak: {n} days', vi: 'Chuỗi dài nhất: {n} ngày' },
  'dailyGoal.title': { en: 'Daily goal', vi: 'Mục tiêu hằng ngày' },
  'dailyGoal.change': { en: 'Change daily goal', vi: 'Đổi mục tiêu hằng ngày' },
  'dailyGoal.option': { en: '{xp} XP', vi: '{xp} XP' },
  'dailyGoal.optionLabel': { en: '{xp} XP per day', vi: '{xp} XP mỗi ngày' },
  'hearts.empty.title': { en: 'Out of hearts', vi: 'Hết tim rồi' },
  'hearts.empty.body': {
    en: 'You need a heart to start a lesson. Next heart in {min} min. Puzzles are still open!',
    vi: 'Bạn cần ít nhất một tim để bắt đầu bài học. Tim tiếp theo sau {min} phút. Bạn vẫn có thể giải câu đố!',
  },
  'hearts.lost': { en: 'You lost a heart. {n} left.', vi: 'Bạn bị mất một tim. Còn {n} tim.' },
  'hearts.noneLeft': {
    en: 'You’re out of hearts, but you can finish this lesson.',
    vi: 'Bạn đã hết tim, nhưng vẫn có thể hoàn thành bài học này.',
  },
  'lesson.hearts': { en: 'Hearts: {n}', vi: 'Tim: {n}' },
  'xp.earned': { en: '+{xp} XP', vi: '+{xp} XP' },
  'xp.none': { en: 'Already solved: no XP this time.', vi: 'Đã giải trước đó: lần này không có XP.' },

  // ---------- Puzzle list ----------
  'puzzles.title': { en: 'Puzzles', vi: 'Câu đố' },
  'puzzles.subtitle': { en: 'Find the winning move', vi: 'Tìm nước đi chiến thắng' },
  'puzzles.solvedCount': { en: '{done} of {total} puzzles solved', vi: 'Đã giải {done}/{total} câu đố' },
  'puzzles.groupBy': { en: 'Group puzzles by', vi: 'Nhóm câu đố theo' },
  'puzzles.byDifficulty': { en: 'Difficulty', vi: 'Độ khó' },
  'puzzles.byTheme': { en: 'Theme', vi: 'Chủ đề' },
  'puzzles.level': { en: 'Level {n}', vi: 'Cấp {n}' },
  'puzzles.number': { en: 'Puzzle {n}', vi: 'Câu đố {n}' },
  'puzzles.solved': { en: 'solved', vi: 'đã giải' },
  'puzzles.unsolved': { en: 'not solved yet', vi: 'chưa giải' },
  'goal.mate-in-1': { en: 'Mate in 1', vi: 'Chiếu bí 1 nước' },
  'goal.mate-in-2': { en: 'Mate in 2', vi: 'Chiếu bí 2 nước' },
  'goal.win-material': { en: 'Win material', vi: 'Ăn quân' },
  'goal.short.mate-in-1': { en: 'M1', vi: 'B1' },
  'goal.short.mate-in-2': { en: 'M2', vi: 'B2' },
  'goal.short.win-material': { en: '+', vi: '+' },
  'theme.chariot': { en: 'Chariot', vi: 'Xe' },
  'theme.horse': { en: 'Horse', vi: 'Mã' },
  'theme.cannon': { en: 'Cannon', vi: 'Pháo' },
  'theme.soldier': { en: 'Soldier', vi: 'Tốt' },
  'theme.double-check': { en: 'Double check', vi: 'Chiếu đôi' },
  'theme.flying-general': { en: 'Flying general', vi: 'Lộ mặt Tướng' },
  'theme.fork': { en: 'Fork', vi: 'Bắt đôi' },
  'theme.sacrifice': { en: 'Sacrifice', vi: 'Thí quân' },

  // ---------- Puzzle player ----------
  'puzzle.back': { en: 'Back to puzzles', vi: 'Quay lại danh sách câu đố' },
  'puzzle.toMove.red': { en: 'Red to move', vi: 'Đỏ đi' },
  'puzzle.toMove.black': { en: 'Black to move', vi: 'Đen đi' },
  'puzzle.prompt.mate-in-1': { en: 'Checkmate in one move.', vi: 'Chiếu bí trong một nước.' },
  'puzzle.prompt.mate-in-2': {
    en: 'Checkmate in two moves, whatever Black does.',
    vi: 'Chiếu bí trong hai nước, dù bên Đen đi thế nào.',
  },
  'puzzle.prompt.win-material': {
    en: 'Find the move that wins material.',
    vi: 'Tìm nước đi giúp bạn ăn được quân.',
  },
  'puzzle.yourMove': { en: 'Your move', vi: 'Đến lượt bạn' },
  'puzzle.opponentMoving': { en: 'Black replies…', vi: 'Bên Đen đang đi…' },
  'puzzle.hint': { en: 'Hint', vi: 'Gợi ý' },
  'puzzle.hintMore': { en: 'Show target', vi: 'Xem điểm đến' },
  'puzzle.showSolution': { en: 'Show solution', vi: 'Xem lời giải' },
  'puzzle.retry': { en: 'Try again', vi: 'Thử lại' },
  'puzzle.next': { en: 'Next puzzle', vi: 'Câu đố tiếp theo' },
  'puzzle.restart': { en: 'Try it yourself', vi: 'Tự giải lại' },
  'puzzle.solvedTitle': { en: 'Solved!', vi: 'Giải được rồi!' },
  'puzzle.solvedBody': { en: 'Great move. Keep going!', vi: 'Nước đi tuyệt vời. Tiếp tục nào!' },
  'puzzle.revealedTitle': { en: 'Solution', vi: 'Lời giải' },
  'puzzle.revealedBody': {
    en: 'That’s the winning line. Try another puzzle, or play it yourself.',
    vi: 'Đây là đường thắng. Hãy thử câu đố khác, hoặc tự giải lại.',
  },
  'puzzle.wrong': { en: 'Not the winning move', vi: 'Chưa phải nước thắng' },
  'puzzle.wrong.wrong.mate': {
    en: 'Black can escape after that. Look for a stronger move.',
    vi: 'Sau nước đó bên Đen vẫn thoát được. Hãy tìm nước mạnh hơn.',
  },
  'puzzle.wrong.wrong.material': {
    en: 'That doesn’t win material against Black’s best reply.',
    vi: 'Nước đó không ăn được quân nếu bên Đen đáp trả tốt nhất.',
  },
  'puzzle.wrong.illegal': { en: 'That piece can’t move there.', vi: 'Quân đó không thể đi tới điểm này.' },
  'puzzle.wrong.unsafe': {
    en: 'That move would leave your General under attack.',
    vi: 'Nước đi đó khiến Tướng của bạn bị tấn công.',
  },
  'board.hint': { en: 'hint', vi: 'gợi ý' },

  // ---------- Puzzle hints (one per player step) ----------
  'hint.check': { en: 'Start with a check.', vi: 'Hãy bắt đầu bằng một nước chiếu.' },
  'hint.quiet': {
    en: 'The key move is not a check: first take away the General’s escape squares.',
    vi: 'Nước then chốt không phải nước chiếu: trước tiên hãy chặn đường thoát của Tướng.',
  },
  'hint.sacrifice': { en: 'Don’t be afraid to give up a piece.', vi: 'Đừng ngại thí một quân.' },
  'hint.cannon-screen': {
    en: 'A Cannon checks with exactly one piece between it and the General.',
    vi: 'Pháo chiếu khi có đúng một quân (ngòi) nằm giữa Pháo và Tướng.',
  },
  'hint.flying-general': {
    en: 'Your General controls its whole file. Use it.',
    vi: 'Tướng của bạn khống chế cả đường dọc. Hãy tận dụng nó.',
  },
  'hint.double-check': {
    en: 'Attack the General with two pieces at once.',
    vi: 'Hãy chiếu Tướng bằng hai quân cùng lúc.',
  },
  'hint.horse': { en: 'Your Horse can deliver the blow. Check its leg!', vi: 'Quân Mã có thể ra đòn. Nhớ kiểm tra chân Mã!' },
  'hint.fork': { en: 'Find a move that attacks two things at once.', vi: 'Tìm nước đi tấn công hai mục tiêu cùng lúc.' },
  'hint.free-piece': { en: 'One black piece is not protected.', vi: 'Có một quân Đen không được bảo vệ.' },
  'hint.chariot': {
    en: 'Your Chariot can reach the General along an open line.',
    vi: 'Xe của bạn có thể chiếu Tướng theo một đường trống.',
  },
  'hint.soldier': { en: 'Even a Soldier can deliver checkmate.', vi: 'Ngay cả quân Tốt cũng có thể chiếu bí.' },
  'hint.finish': { en: 'Now finish it: checkmate!', vi: 'Giờ kết thúc thôi: chiếu bí!' },
  'hint.collect': { en: 'Now collect the material.', vi: 'Giờ hãy ăn quân.' },

  // ---------- Unit 1: The board and the palace ----------
  'u1.title': { en: 'The board and the palace', vi: 'Bàn cờ và cung' },
  'u1.desc': {
    en: 'Points, river, palace, the General and its bodyguards.',
    vi: 'Giao điểm, sông, cung, quân Tướng và các quân hộ vệ.',
  },

  'u1l1.title': { en: 'The board', vi: 'Bàn cờ' },
  'u1l1.e1': {
    en: 'Xiangqi pieces stand on the points where lines cross: 9 lines across and 10 down. Red sits at the bottom and always moves first.',
    vi: 'Quân cờ tướng đặt trên các giao điểm: 9 đường dọc và 10 đường ngang. Bên Đỏ ở phía dưới và luôn đi trước.',
  },
  'u1l1.e2': {
    en: 'The river splits the board in half. The highlighted five rows are Red’s side.',
    vi: 'Con sông chia đôi bàn cờ. Năm hàng được tô sáng là phần sân của bên Đỏ.',
  },
  'u1l1.e3': {
    en: 'Each side has a palace: the 3×3 points marked with an X. Your General lives here.',
    vi: 'Mỗi bên có một cung: 3×3 điểm có đường chéo hình chữ X. Tướng của bạn ở trong cung.',
  },
  'u1l1.e4': { en: 'Tap all 9 points of your palace.', vi: 'Chạm vào cả 9 điểm trong cung của bạn.' },

  'u1l2.title': { en: 'The General', vi: 'Quân Tướng' },
  'u1l2.e1': {
    en: 'The General (帥) moves one point up, down, left or right. Never diagonally.',
    vi: 'Tướng (帥) đi một điểm lên, xuống, sang trái hoặc phải. Không bao giờ đi chéo.',
  },
  'u1l2.e2': { en: 'Tap every point the General can move to.', vi: 'Chạm vào mọi điểm Tướng có thể đi tới.' },
  'u1l2.e3': {
    en: 'Pieces capture by moving onto an enemy piece. The General captures the same way it moves.',
    vi: 'Quân cờ ăn quân bằng cách đi vào điểm có quân đối phương. Tướng ăn quân giống như cách nó đi.',
  },
  'u1l2.e4': { en: 'Capture the black Soldier with your General.', vi: 'Dùng Tướng ăn quân Tốt đen.' },
  'u1l2.e5': {
    en: 'Never move the General onto a point an enemy attacks. Here the black Chariot controls a whole line.',
    vi: 'Không bao giờ đưa Tướng vào điểm bị đối phương tấn công. Ở đây Xe đen khống chế cả một đường.',
  },
  'u1l2.e6': {
    en: 'Your General is attacked by a Chariot. Move it to the only safe point.',
    vi: 'Tướng của bạn bị Xe tấn công. Hãy đưa Tướng tới điểm an toàn duy nhất.',
  },

  'u1l3.title': { en: 'Advisor and Elephant', vi: 'Sĩ và Tượng' },
  'u1l3.e1': {
    en: 'The Advisor (仕) moves one point diagonally and never leaves the palace.',
    vi: 'Sĩ (仕) đi chéo một điểm và không bao giờ ra khỏi cung.',
  },
  'u1l3.e2': { en: 'Tap every point the Advisor can move to.', vi: 'Chạm vào mọi điểm Sĩ có thể đi tới.' },
  'u1l3.e3': {
    en: 'The Elephant (相) moves exactly two points diagonally, across the corner of a square.',
    vi: 'Tượng (相) đi chéo đúng hai điểm, theo đường chéo của một ô vuông lớn.',
  },
  'u1l3.e4': { en: 'Tap every point the Elephant can move to.', vi: 'Chạm vào mọi điểm Tượng có thể đi tới.' },
  'u1l3.e5': {
    en: 'The point in the middle of an Elephant move is its “eye”. If any piece stands there, that move is blocked.',
    vi: 'Điểm ở giữa đường đi của Tượng gọi là “mắt Tượng”. Nếu có quân nào đứng ở đó, Tượng không đi được hướng đó (cản mắt Tượng).',
  },
  'u1l3.e6': {
    en: 'Two eyes are blocked. Tap every point the Elephant can still reach.',
    vi: 'Hai mắt Tượng bị cản. Chạm vào mọi điểm Tượng vẫn đi tới được.',
  },

  // ---------- Unit 2: Chariot and Horse ----------
  'u2.title': { en: 'Chariot and Horse', vi: 'Xe và Mã' },
  'u2.desc': { en: 'The strongest piece, and the trickiest one.', vi: 'Quân mạnh nhất và quân khó đoán nhất.' },

  'u2l1.title': { en: 'The Chariot', vi: 'Quân Xe' },
  'u2l1.e1': {
    en: 'The Chariot (俥) slides any number of points in a straight line until something is in the way. It is the strongest piece.',
    vi: 'Xe (俥) đi thẳng bao nhiêu điểm cũng được cho tới khi gặp vật cản. Đây là quân mạnh nhất.',
  },
  'u2l1.e2': {
    en: 'Tap every point the Chariot can move to. It can’t pass your own pieces.',
    vi: 'Chạm vào mọi điểm Xe có thể đi tới. Xe không đi xuyên qua quân của mình.',
  },
  'u2l1.e3': { en: 'Capture the black Cannon with your Chariot.', vi: 'Dùng Xe ăn quân Pháo đen.' },
  'u2l1.e4': {
    en: 'The black Horse is protected by the black Chariot. Find the capture that wins material.',
    vi: 'Mã đen được Xe đen bảo vệ. Hãy tìm nước ăn quân có lợi.',
  },

  'u2l2.title': { en: 'The Horse', vi: 'Quân Mã' },
  'u2l2.e1': {
    en: 'The Horse (傌) moves one point straight, then one point diagonally outward: an L shape.',
    vi: 'Mã (傌) đi thẳng một điểm rồi chéo ra ngoài một điểm, tạo thành hình chữ L (Mã đi chữ nhật).',
  },
  'u2l2.e2': { en: 'Tap every point the Horse can move to.', vi: 'Chạm vào mọi điểm Mã có thể đi tới.' },
  'u2l2.e3': {
    en: 'The first, straight step is the Horse’s “leg”. If any piece stands there, the Horse can’t go that way. Here your Soldier blocks two moves.',
    vi: 'Bước đi thẳng đầu tiên là “chân Mã”. Nếu có quân đứng ở đó, Mã không đi được hướng ấy (bị cản chân). Ở đây Tốt của bạn cản hai nước.',
  },
  'u2l2.e4': {
    en: 'Two legs are blocked. Tap every point the Horse can still reach.',
    vi: 'Hai chân Mã bị cản. Chạm vào mọi điểm Mã vẫn đi tới được.',
  },
  'u2l2.e5': {
    en: 'Win the biggest piece you can. Watch out for blocked legs!',
    vi: 'Hãy ăn quân lớn nhất có thể. Cẩn thận chân Mã bị cản!',
  },

  // ---------- Unit 3: Cannon and Soldier ----------
  'u3.title': { en: 'Cannon and Soldier', vi: 'Pháo và Tốt' },
  'u3.desc': {
    en: 'The jumping Cannon and the Soldier that grows stronger.',
    vi: 'Pháo ăn quân bằng cách nhảy, và Tốt mạnh lên khi qua sông.',
  },

  'u3l1.title': { en: 'The Cannon', vi: 'Quân Pháo' },
  'u3l1.e1': {
    en: 'When it is not capturing, the Cannon (炮) moves exactly like a Chariot: any distance in a straight line.',
    vi: 'Khi không ăn quân, Pháo (炮) đi giống hệt Xe: đi thẳng bao xa cũng được.',
  },
  'u3l1.e2': {
    en: 'The Cannon can’t capture a piece directly in front of it. With nothing in between, the black Chariot is safe.',
    vi: 'Pháo không ăn được quân đứng ngay trước mặt. Không có quân ở giữa nên Xe đen vẫn an toàn.',
  },
  'u3l1.e3': {
    en: 'To capture, the Cannon jumps over exactly one piece (the “screen”) and lands on the enemy piece behind it.',
    vi: 'Để ăn quân, Pháo phải nhảy qua đúng một quân (gọi là “ngòi”) và ăn quân đối phương phía sau.',
  },
  'u3l1.e4': {
    en: 'Capture with the Cannon. Remember: it needs a screen.',
    vi: 'Dùng Pháo ăn quân. Nhớ rằng Pháo cần có ngòi.',
  },
  'u3l1.e5': {
    en: 'Your own piece can be the screen too. Win the black Chariot.',
    vi: 'Quân của mình cũng làm ngòi được. Hãy ăn Xe đen.',
  },
  'u3l1.e6': { en: 'Checkmate in one move with your two Cannons.', vi: 'Chiếu bí trong một nước bằng hai quân Pháo.' },

  'u3l2.title': { en: 'The Soldier', vi: 'Quân Tốt' },
  'u3l2.e1': {
    en: 'The Soldier (兵) moves one point forward. Before crossing the river, that is its only move.',
    vi: 'Tốt (兵) đi tiến một điểm. Khi chưa qua sông, đó là nước đi duy nhất của nó.',
  },
  'u3l2.e2': {
    en: 'Once across the river, the Soldier may also step left or right. It never moves backward.',
    vi: 'Khi đã qua sông, Tốt được đi ngang sang trái hoặc phải. Tốt không bao giờ đi lùi.',
  },
  'u3l2.e3': { en: 'Tap every point the Soldier can move to.', vi: 'Chạm vào mọi điểm Tốt có thể đi tới.' },
  'u3l2.e4': {
    en: 'Your Soldier can capture forward or sideways. Win the most valuable piece.',
    vi: 'Tốt có thể ăn tiến hoặc ăn ngang. Hãy ăn quân giá trị nhất.',
  },
  'u3l2.e5': { en: 'Checkmate in one move.', vi: 'Chiếu bí trong một nước.' },

  // ---------- Unit 4: Check and checkmate ----------
  'u4.title': { en: 'Check and checkmate', vi: 'Chiếu và chiếu bí' },
  'u4.desc': {
    en: 'Facing Generals, check, and how to win.',
    vi: 'Lộ mặt Tướng, chiếu Tướng và cách giành chiến thắng.',
  },

  'u4l1.title': { en: 'Check', vi: 'Chiếu Tướng' },
  'u4l1.e1': {
    en: 'The two Generals may never face each other on the same line with nothing in between. Moving to the marked point would do that, so it isn’t allowed.',
    vi: 'Hai Tướng không bao giờ được đối mặt trên cùng một đường dọc mà không có quân nào ở giữa (lộ mặt Tướng). Đi tới điểm được đánh dấu sẽ gây ra điều đó nên không được phép.',
  },
  'u4l1.e2': {
    en: 'A piece standing alone between the Generals is pinned: if it moved away, the Generals would face each other. This Horse can’t move at all.',
    vi: 'Quân duy nhất đứng giữa hai Tướng bị ghim: nếu nó đi ra, hai Tướng sẽ đối mặt. Quân Mã này không đi được nước nào.',
  },
  'u4l1.e3': {
    en: 'Your General is in check: the black Chariot attacks it. You must deal with check at once. The dots show the escapes.',
    vi: 'Tướng của bạn đang bị chiếu: Xe đen đang tấn công. Bạn phải xử lý ngay. Các chấm xanh là đường thoát.',
  },
  'u4l1.e4': { en: 'Give check with the Chariot.', vi: 'Dùng Xe chiếu Tướng.' },
  'u4l1.e5': {
    en: 'The black Horse gives check. Make any move that gets your General to safety.',
    vi: 'Mã đen đang chiếu. Hãy đi một nước bất kỳ để Tướng được an toàn.',
  },
  'u4l1.e6': { en: 'You are in check. Capture the attacker!', vi: 'Bạn đang bị chiếu. Hãy ăn quân đang chiếu!' },

  'u4l2.title': { en: 'Checkmate', vi: 'Chiếu bí' },
  'u4l2.e1': {
    en: 'Checkmate: the black General is in check and has no legal move to escape. Red wins!',
    vi: 'Chiếu bí: Tướng đen bị chiếu và không còn nước nào để thoát. Bên Đỏ thắng!',
  },
  'u4l2.e2': {
    en: 'Checkmate in one! Your General controls its whole line, so use it.',
    vi: 'Chiếu bí trong một nước! Tướng của bạn khống chế cả đường dọc, hãy tận dụng điều đó.',
  },
  'u4l2.e3': { en: 'Checkmate in one with your two Chariots.', vi: 'Chiếu bí trong một nước bằng hai Xe.' },
  'u4l2.e4': {
    en: 'Checkmate in one with Horse and Cannon, a classic pattern.',
    vi: 'Chiếu bí trong một nước bằng Mã và Pháo (thế Mã hậu Pháo).',
  },
  'u4l2.e5': {
    en: 'In Xiangqi, a side with no legal moves loses, even when it is not in check. Black is to move here and is stuck, so Red wins.',
    vi: 'Trong cờ tướng, bên hết nước đi sẽ thua, kể cả khi không bị chiếu. Ở đây đến lượt Đen nhưng không còn nước đi, nên bên Đỏ thắng.',
  },
  'u4l2.e6': { en: 'Checkmate in one with a Soldier.', vi: 'Chiếu bí trong một nước bằng quân Tốt.' },

  // ---------- Intermediate track ----------
  'u7.title': { en: 'Cannon mating patterns', vi: 'Sát cục bằng Pháo' },
  'u7.desc': {
    en: 'Double Cannon, the Smothered General and Horse-behind-Cannon.',
    vi: 'Trùng pháo, Muộn cung và Mã hậu pháo.',
  },
  'u7l1.title': { en: 'Double Cannon', vi: 'Trùng pháo' },
  'u7l1.e1': {
    en: 'Double Cannon: two Cannons on one line. The front Cannon is the rear Cannon’s screen, so the check cannot be blocked by a single piece, and the point in front of the General is hit too. Here the Red General’s open file also guards the side point.',
    vi: 'Trùng pháo: hai Pháo cùng một đường. Pháo trước làm ngòi cho Pháo sau, nên một quân chặn không đỡ được, và điểm ngay trước Tướng cũng bị khống chế. Ở đây đường dọc thông của Tướng Đỏ còn khóa luôn điểm bên cạnh.',
  },
  'u7l1.p1': { en: 'Checkmate in one with a Double Cannon.', vi: 'Chiếu bí trong một nước bằng thế Trùng pháo.' },
  'u7l1.p2': {
    en: 'Mate in 2: drive the General onto your Cannons’ line, then finish with a Double Cannon.',
    vi: 'Chiếu bí sau 2 nước: dồn Tướng vào đường của hai Pháo, rồi kết thúc bằng Trùng pháo.',
  },
  'u7l1.x1': {
    en: 'The rear Cannon jumps over the front one. The General cannot step forward, because that point is on the same line.',
    vi: 'Pháo sau bắn qua Pháo trước. Tướng không thể tiến lên vì điểm đó vẫn nằm trên cùng đường bắn.',
  },
  'u7l1.x2': {
    en: 'The Cannons shut the file and the Red General’s open file takes away the escape to the side. Never forget your own General!',
    vi: 'Hai Pháo khóa đường dọc, còn đường thông của Tướng Đỏ lấy mất lối thoát bên cạnh. Đừng quên Tướng của mình!',
  },
  'u7l1.x3': {
    en: 'The Chariot’s check pushed the General onto the Cannons’ file. A forcing check first, then the pattern.',
    vi: 'Nước chiếu của Xe đẩy Tướng vào đường dọc của hai Pháo. Chiếu ép trước, rồi mới ra thế cờ.',
  },
  'u7l1.x4': { en: 'Double Cannon works along a rank too, not only a file.', vi: 'Trùng pháo dùng được cả theo hàng ngang, không chỉ hàng dọc.' },

  'u7l2.title': { en: 'Smothered General', vi: 'Muộn cung' },
  'u7l2.e1': {
    en: 'Smothered General: the black General is boxed in by its own pieces. A Cannon checks, using one of them as the screen, and the General has nowhere to step.',
    vi: 'Muộn cung: Tướng đen bị chính quân nhà vây kín. Pháo chiếu, dùng một trong những quân đó làm ngòi, và Tướng không còn chỗ nào để đi.',
  },
  'u7l2.p1': {
    en: 'Checkmate in one. Look for a General hemmed in by its own pieces.',
    vi: 'Chiếu bí trong một nước. Hãy tìm Tướng bị chính quân nhà vây kín.',
  },
  'u7l2.x1': {
    en: 'Black’s own Advisor became the screen. Every point next to the General is blocked by a black piece.',
    vi: 'Chính quân Đen làm ngòi cho Pháo. Mọi điểm quanh Tướng đều bị quân Đen chặn.',
  },

  'u7l2.p2': {
    en: 'Mate in 2: prepare a Smothered General.',
    vi: 'Chiếu bí sau 2 nước: chuẩn bị thế Muộn cung.',
  },
  'u7l2.x2': {
    en: 'The first move took away Black’s only breathing room. Then the Cannon mated through Black’s own piece.',
    vi: 'Nước đầu lấy mất khoảng trống duy nhất của Đen. Sau đó Pháo chiếu bí xuyên qua chính quân Đen.',
  },
  'u7l3.x3': {
    en: 'The Horse jumped in front of the Cannon and became its screen, guarding the escape points as it landed.',
    vi: 'Mã nhảy lên trước Pháo để làm ngòi, đồng thời khống chế các điểm thoát ngay khi đáp xuống.',
  },

  'u7l3.title': { en: 'Horse-behind-Cannon', vi: 'Mã hậu pháo' },
  'u7l3.e1': {
    en: 'Horse-behind-Cannon: the Horse stands on the General’s line and acts as the screen, while it also guards the points beside the General. Each piece covers what the other cannot.',
    vi: 'Mã hậu pháo: Mã đứng trên đường của Tướng làm ngòi cho Pháo, đồng thời khống chế các điểm cạnh Tướng. Mỗi quân che chỗ hở của quân kia.',
  },
  'u7l3.p1': { en: 'Checkmate in one with Horse and Cannon.', vi: 'Chiếu bí trong một nước bằng Mã và Pháo.' },
  'u7l3.p2': {
    en: 'Mate in 2 with Horse and Cannon. Black will defend as well as possible.',
    vi: 'Chiếu bí sau 2 nước bằng Mã và Pháo. Đen sẽ phòng thủ tốt nhất có thể.',
  },
  'u7l3.x1': {
    en: 'The Horse is the screen and guards the escape squares at the same time.',
    vi: 'Mã vừa làm ngòi vừa khống chế các đường thoát.',
  },
  'u7l3.x2': {
    en: 'The Horse checked first and stayed on the General’s line, ready to be the Cannon’s screen.',
    vi: 'Mã chiếu trước rồi nằm lại trên đường của Tướng, sẵn sàng làm ngòi cho Pháo.',
  },

  'u8.title': { en: 'Horse and Chariot mates', vi: 'Sát cục bằng Mã và Xe' },
  'u8.desc': {
    en: 'The Palcorner Horse, two Chariots, Chariot and Horse, and your General in attack.',
    vi: 'Ngọa tào mã, Song xa, Xe Mã phối hợp và Tướng trợ chiến.',
  },
  'u8l1.title': { en: 'Palcorner Horse', vi: 'Ngọa tào mã' },
  'u8l1.e1': {
    en: 'Palcorner Horse: a Horse next to the palace corner checks the General from the side. Partners take the other points; here a Soldier covers two of them and the Red General’s file covers the last.',
    vi: 'Ngọa tào mã: Mã đứng sát góc cung chiếu Tướng từ bên hông. Các quân khác khóa những điểm còn lại; ở đây Tốt khóa hai điểm, đường dọc của Tướng Đỏ khóa điểm cuối.',
  },
  'u8l1.p1': { en: 'Checkmate in one with the Horse.', vi: 'Chiếu bí trong một nước bằng Mã.' },
  'u8l1.p2': { en: 'Mate in 2: prepare the Horse’s jump, then mate.', vi: 'Chiếu bí sau 2 nước: chuẩn bị đường nhảy cho Mã, rồi chiếu bí.' },
  'u8l1.p3': {
    en: 'Checkmate in one. The Horse is in place, but something blocks its leg.',
    vi: 'Chiếu bí trong một nước. Mã đã vào vị trí, nhưng có quân đang cản chân Mã.',
  },
  'u8l1.x1': {
    en: 'The Horse checks from beside the palace; its partners close every escape.',
    vi: 'Mã chiếu từ cạnh cung; các quân phối hợp đóng mọi lối thoát.',
  },
  'u8l1.x2': {
    en: 'Moving the Chariot unblocked the Horse’s leg: a discovered check. The Chariot now guards the escape.',
    vi: 'Xe rời đi để mở chân Mã: một nước chiếu mở. Giờ Xe khóa luôn đường thoát.',
  },

  'u8l2.title': { en: 'Two Chariots', vi: 'Song xa' },
  'u8l2.e1': {
    en: 'Two Chariots: one Chariot cuts off a whole rank, the other checks on the next one. The General is trapped between them.',
    vi: 'Song xa: một Xe khóa cả một hàng ngang, Xe kia chiếu ở hàng kế bên. Tướng bị kẹp giữa hai Xe.',
  },
  'u8l2.p1': { en: 'Mate in 2 with your two Chariots.', vi: 'Chiếu bí sau 2 nước bằng hai Xe.' },
  'u8l2.x1': {
    en: 'Check, then the other Chariot finishes. The Chariots take turns: one cuts off, one checks.',
    vi: 'Chiếu, rồi Xe kia kết thúc. Hai Xe thay phiên: một Xe khóa đường, một Xe chiếu.',
  },
  'u8l2.x2': {
    en: 'The first move was not a check: it built a wall behind the General. Black had no answer to the coming check.',
    vi: 'Nước đầu không chiếu: nó dựng một bức tường sau lưng Tướng. Đen không có cách đỡ nước chiếu tiếp theo.',
  },

  'u8l3.title': { en: 'Chariot and Horse', vi: 'Xe Mã phối hợp' },
  'u8l3.e1': {
    en: 'Chariot and Horse: the Horse takes away points the Chariot cannot reach, and the Chariot checks along the open line.',
    vi: 'Xe Mã phối hợp: Mã khống chế những điểm Xe không với tới, còn Xe chiếu theo đường thông.',
  },
  'u8l3.p1': { en: 'Mate in 2 with Chariot and Horse.', vi: 'Chiếu bí sau 2 nước bằng Xe và Mã.' },
  'u8l3.x1': {
    en: 'One piece checks, the other covers the escape. Watch which points each piece controls.',
    vi: 'Một quân chiếu, quân kia khóa đường thoát. Hãy để ý mỗi quân khống chế những điểm nào.',
  },

  'u8l4.title': { en: 'Your General attacks', vi: 'Tướng trợ chiến' },
  'u8l4.e1': {
    en: 'The Generals may never face each other on an open file. So your General controls its whole file and can guard an escape point all the way across the board.',
    vi: 'Hai Tướng không được đối mặt trên một đường dọc thông. Vì vậy Tướng của bạn khống chế cả đường dọc và có thể khóa điểm thoát ở tận bên kia bàn cờ.',
  },
  'u8l4.p1': {
    en: 'Checkmate in one. Your General helps.',
    vi: 'Chiếu bí trong một nước. Tướng của bạn sẽ hỗ trợ.',
  },
  'u8l4.p2': {
    en: 'Mate in 2. Use the General as an attacker.',
    vi: 'Chiếu bí sau 2 nước. Hãy dùng Tướng như một quân tấn công.',
  },
  'u8l4.x1': {
    en: 'The black General cannot step onto your General’s file: that is the point it needed.',
    vi: 'Tướng đen không được bước vào đường dọc của Tướng bạn: đó chính là điểm nó cần.',
  },
  'u8l4.x2': {
    en: 'A quiet General move! It took away an escape point, and Black could not stop the mate.',
    vi: 'Một nước đi Tướng êm! Nó lấy mất điểm thoát, và Đen không thể ngăn nước chiếu bí.',
  },

  'u9.title': { en: 'Tactics', vi: 'Chiến thuật' },
  'u9.desc': {
    en: 'Forks, double check, and stopping your opponent’s mate.',
    vi: 'Đòn bắt đôi, chiếu kép và cách chặn đòn chiếu bí của đối phương.',
  },
  'u9l1.title': { en: 'Forks', vi: 'Bắt đôi' },
  'u9l1.e1': {
    en: 'A fork attacks two things at once. The strongest fork is a check that also attacks a piece: Black must save the General, and then you take the piece.',
    vi: 'Bắt đôi là tấn công hai mục tiêu cùng lúc. Đòn mạnh nhất là nước chiếu đồng thời đe dọa một quân: Đen buộc phải cứu Tướng, rồi bạn ăn quân kia.',
  },
  'u9l1.p1': {
    en: 'Win material in 2: check and attack at the same time.',
    vi: 'Thắng quân sau 2 nước: vừa chiếu vừa tấn công.',
  },
  'u9l1.x1': {
    en: 'Check plus attack: Black could only save the General, so the other piece fell.',
    vi: 'Vừa chiếu vừa đánh: Đen chỉ kịp cứu Tướng, nên quân kia bị ăn.',
  },
  'u9l1.x2': {
    en: 'The Horse fork: one jump checked the General and attacked a piece. Horses are the best forking pieces.',
    vi: 'Mã bắt đôi: một bước nhảy vừa chiếu Tướng vừa đe dọa quân khác. Mã là quân bắt đôi lợi hại nhất.',
  },
  'u9l1.x3': {
    en: 'Once the screen changed, the Cannon could take. Watch how each move adds or removes a Cannon’s screen.',
    vi: 'Khi ngòi thay đổi, Pháo ăn được quân. Hãy để ý mỗi nước đi thêm hay bớt ngòi cho Pháo thế nào.',
  },
  'u9l2.title': { en: 'Double check', vi: 'Chiếu kép' },
  'u9l2.e1': {
    en: 'Double check: two pieces give check at once. Blocking one line or capturing one checker is not enough, so the General usually has to move, and often cannot.',
    vi: 'Chiếu kép: hai quân cùng chiếu một lúc. Chặn một đường hay ăn một quân chiếu là không đủ, nên Tướng thường phải tự chạy, và nhiều khi không chạy được.',
  },
  'u9l2.p1': { en: 'Mate in 2. Look for a double check.', vi: 'Chiếu bí sau 2 nước. Hãy tìm nước chiếu kép.' },
  'u9l2.x1': {
    en: 'Moving one piece opened a second line of attack. Two checks at once leave very few defences.',
    vi: 'Đi một quân để mở thêm một đường tấn công. Hai nước chiếu cùng lúc khiến đối phương gần như không thể đỡ.',
  },
  'u9l3.title': { en: 'Stop the threat', vi: 'Chặn đòn đe dọa' },
  'u9l3.e1': {
    en: 'Before every move, ask: what does my opponent threaten? Here Black is ready to checkmate. Find Black’s mating move first, then look for the move that stops it.',
    vi: 'Trước mỗi nước, hãy tự hỏi: đối phương đang đe dọa gì? Ở đây Đen sắp chiếu bí. Hãy tìm nước chiếu bí của Đen trước, rồi tìm nước để chặn nó.',
  },
  'u9l3.p1': {
    en: 'Black threatens checkmate. Find a move that stops it.',
    vi: 'Đen đang dọa chiếu bí. Hãy tìm nước đi để chặn đòn đó.',
  },
  'u9l3.x1': {
    en: 'Threat stopped. Only one or two moves save the game here; spotting the threat is what makes them easy to find.',
    vi: 'Đã chặn được. Ở đây chỉ có một hai nước cứu được ván cờ; nhận ra mối đe dọa giúp bạn tìm thấy chúng dễ dàng.',
  },

  'u10.title': { en: 'Combinations', vi: 'Đòn phối hợp' },
  'u10.desc': {
    en: 'Sacrifices, quiet moves and mate in three against the best defence.',
    vi: 'Thí quân, nước êm và chiếu bí sau ba nước trước cách phòng thủ tốt nhất.',
  },
  'u10l1.title': { en: 'Sacrifice to mate', vi: 'Thí quân để chiếu bí' },
  'u10l1.e1': {
    en: 'A sacrifice gives up material to force the enemy General or its defenders onto worse points. Here Red gave a whole Chariot to pull the General forward, and now Black’s own Advisor is the Cannon’s screen.',
    vi: 'Thí quân là bỏ quân để ép Tướng hoặc quân phòng thủ của đối phương vào chỗ xấu. Ở đây Đỏ thí hẳn một Xe để kéo Tướng lên, và giờ chính Sĩ đen làm ngòi cho Pháo.',
  },
  'u10l1.p1': {
    en: 'Mate in 2. The first move gives up a piece.',
    vi: 'Chiếu bí sau 2 nước. Nước đầu tiên phải thí một quân.',
  },
  'u10l1.x1': {
    en: 'Material does not matter when the General falls. Taking the sacrifice was Black’s best try, and it still lost.',
    vi: 'Quân nhiều ít không quan trọng khi Tướng bị bắt. Ăn quân thí là cách chống đỡ tốt nhất của Đen, nhưng vẫn thua.',
  },
  'u10l2.title': { en: 'Quiet moves', vi: 'Nước êm' },
  'u10l2.e1': {
    en: 'Not every winning move is a check. A quiet move sets up two threats or takes away an escape point. Here the first Cannon move opened the Red General’s file and lined up a Double Cannon.',
    vi: 'Không phải nước thắng nào cũng là nước chiếu. Nước êm tạo hai mối đe dọa hoặc lấy mất điểm thoát. Ở đây nước Pháo đầu tiên mở đường dọc cho Tướng Đỏ và xếp thế Trùng pháo.',
  },
  'u10l2.p1': {
    en: 'Mate in 2. The first move is not a check.',
    vi: 'Chiếu bí sau 2 nước. Nước đầu tiên không phải nước chiếu.',
  },
  'u10l2.x1': {
    en: 'After the quiet move Black had no defence against every mating threat.',
    vi: 'Sau nước êm, Đen không thể đỡ được mọi đòn chiếu bí.',
  },
  'u10l3.title': { en: 'Mate in 3', vi: 'Chiếu bí sau 3 nước' },
  'u10l3.e1': {
    en: 'Longer combinations: each check pushes the General somewhere worse, until the last one mates. Count Black’s replies at every step.',
    vi: 'Đòn phối hợp dài hơn: mỗi nước chiếu dồn Tướng vào chỗ tệ hơn, cho tới nước chiếu bí cuối cùng. Hãy tính các nước đáp của Đen ở từng bước.',
  },
  'u10l3.p1': { en: 'Mate in 3 against the best defence.', vi: 'Chiếu bí sau 3 nước trước cách phòng thủ tốt nhất.' },
  'u10l3.x1': {
    en: 'Every move was forcing, so Black never had time to defend.',
    vi: 'Nước nào cũng ép buộc, nên Đen không bao giờ có thời gian phòng thủ.',
  },

  // ---------- Advanced track ----------
  'u11.title': { en: 'Hidden attacks', vi: 'Đòn đánh ẩn' },
  'u11.desc': {
    en: 'Discovered checks, decoy sacrifices and stopping a mate in 2.',
    vi: 'Chiếu mở, thí quân dụ và chặn đòn chiếu bí sau 2 nước.',
  },
  'u11l1.title': { en: 'Discovered check', vi: 'Chiếu mở' },
  'u11l1.e1': {
    en: 'Discovered check: one piece moves, and a different piece gives the check. It can step out of a Chariot’s or Cannon’s line, or step in as a Cannon’s screen. The piece that moved is free to make its own threat.',
    vi: 'Chiếu mở: một quân di chuyển, và một quân khác chiếu Tướng. Quân đó có thể rời khỏi đường của Xe hay Pháo, hoặc bước vào làm ngòi cho Pháo. Quân vừa đi được tự do tạo đe dọa riêng.',
  },
  'u11l1.p': { en: 'Mate in 2. Start with a discovered check.', vi: 'Chiếu bí sau 2 nước. Hãy bắt đầu bằng một nước chiếu mở.' },
  'u11l1.x': {
    en: 'The check came from a piece that did not move, so Black had to answer it while your other piece got into position.',
    vi: 'Nước chiếu đến từ một quân không di chuyển, nên Đen phải đỡ nó trong khi quân kia của bạn vào vị trí.',
  },
  'u11l2.title': { en: 'Decoy', vi: 'Đòn dụ' },
  'u11l2.e1': {
    en: 'A decoy sacrifice lures a black piece, or the General itself, onto a bad point: there it blocks its own General or walks into a mating net. In the next position Red’s first move offers a piece. Look for the point you want the bait taken on.',
    vi: 'Thí quân dụ là nhử một quân Đen, hoặc chính Tướng, vào một điểm xấu: ở đó nó chặn đường Tướng nhà hoặc đi vào lưới chiếu bí. Ở thế tiếp theo, nước đầu của Đỏ dâng một quân. Hãy tìm điểm mà bạn muốn Đen ăn mồi.',
  },
  'u11l2.p': { en: 'Mate in 3. The first move offers a piece.', vi: 'Chiếu bí sau 3 nước. Nước đầu tiên dâng một quân.' },
  'u11l2.x': {
    en: 'Taking the bait was Black’s best try, but afterwards a black piece stood on the wrong point.',
    vi: 'Ăn mồi là cách chống đỡ tốt nhất của Đen, nhưng sau đó một quân Đen đứng sai chỗ.',
  },
  'u11l3.title': { en: 'Stop the mate in 2', vi: 'Chặn đòn chiếu bí 2 nước' },
  'u11l3.e1': {
    en: 'Look one move deeper. Black threatens a forced mate in two moves, so a move that only stops the first check may not be enough. List Black’s checks and captures, find the key point or piece, then protect it.',
    vi: 'Hãy nhìn sâu thêm một nước. Đen dọa chiếu bí bắt buộc sau hai nước, nên chỉ chặn nước chiếu đầu có thể chưa đủ. Hãy liệt kê các nước chiếu và ăn quân của Đen, tìm điểm hoặc quân then chốt, rồi bảo vệ nó.',
  },
  'u11l3.p': {
    en: 'Black threatens mate in 2. Find a move that stops it.',
    vi: 'Đen dọa chiếu bí sau 2 nước. Hãy tìm nước đi để chặn.',
  },
  'u11l3.x': {
    en: 'Threat stopped: after your move Black has no forced mate in 2.',
    vi: 'Đã chặn được: sau nước của bạn, Đen không còn đòn chiếu bí bắt buộc sau 2 nước.',
  },

  'u12.title': { en: 'Mate in 3', vi: 'Chiếu bí sau 3 nước' },
  'u12.desc': {
    en: 'Three-move attacks: keep checking, finish with Horse or Cannon, and start quietly.',
    vi: 'Đòn tấn công ba nước: chiếu liên tục, kết thúc bằng Mã hoặc Pháo, và khởi đầu bằng nước êm.',
  },
  'u12l1.title': { en: 'Check, check, mate', vi: 'Chiếu liên hoàn' },
  'u12l1.e1': {
    en: 'The simplest long attack is a chain of checks: each one leaves the General fewer points, until none are left. Here three checks in a row ended the game.',
    vi: 'Đòn tấn công dài đơn giản nhất là một chuỗi nước chiếu: mỗi nước làm Tướng còn ít điểm hơn, cho đến khi hết đường. Ở đây ba nước chiếu liên tiếp đã kết thúc ván cờ.',
  },
  'u12l1.p': { en: 'Mate in 3. Every move is a check.', vi: 'Chiếu bí sau 3 nước. Nước nào cũng là nước chiếu.' },
  'u12l1.x': {
    en: 'Each check left Black fewer choices, until there were none.',
    vi: 'Mỗi nước chiếu khiến Đen ít lựa chọn hơn, cho đến khi không còn lựa chọn nào.',
  },
  'u12l2.title': { en: 'Horse and Cannon finish', vi: 'Mã Pháo kết thúc' },
  'u12l2.e1': {
    en: 'Chariots often clear the way, but the Horse and the Cannon deliver many final blows: they attack from angles, and over screens, that defenders cannot easily cover.',
    vi: 'Xe thường mở đường, nhưng Mã và Pháo hay ra đòn kết thúc: chúng tấn công từ những góc, và qua ngòi, mà quân phòng thủ khó che chắn.',
  },
  'u12l2.p': {
    en: 'Mate in 3. The Horse or the Cannon deals the final blow.',
    vi: 'Chiếu bí sau 3 nước. Mã hoặc Pháo ra đòn cuối cùng.',
  },
  'u12l2.x': {
    en: 'The last check came from an angle Black could not block.',
    vi: 'Nước chiếu cuối đến từ một hướng mà Đen không thể chặn.',
  },
  'u12l3.title': { en: 'The quiet start', vi: 'Khởi đầu bằng nước êm' },
  'u12l3.e1': {
    en: 'Sometimes the strongest first move is not a check. A quiet move can take away an escape point or bring one more piece into the attack, and Black has no time to stop both threats.',
    vi: 'Đôi khi nước đầu mạnh nhất không phải nước chiếu. Một nước êm có thể lấy mất điểm thoát hoặc đưa thêm một quân vào tấn công, và Đen không kịp chặn cả hai mối đe dọa.',
  },
  'u12l3.p': { en: 'Mate in 3. The first move is not a check.', vi: 'Chiếu bí sau 3 nước. Nước đầu tiên không phải nước chiếu.' },
  'u12l3.x': {
    en: 'The quiet move created a threat Black could not answer in time.',
    vi: 'Nước êm tạo ra mối đe dọa mà Đen không kịp đối phó.',
  },

  // ---------- Expert track ----------
  'u13.title': { en: 'Expert technique', vi: 'Kỹ thuật chuyên gia' },
  'u13.desc': {
    en: 'Only-move defence, quiet moves on a full board, and discovered attacks over three moves.',
    vi: 'Phòng thủ bằng nước duy nhất, nước êm trên bàn cờ đầy, và chiếu mở trong ba nước.',
  },
  'u13l1.title': { en: 'The only move', vi: 'Nước duy nhất' },
  'u13l1.e1': {
    en: 'One move often decides the game. In these positions Black threatens mate in 2 and exactly one move saves you: every other move loses.',
    vi: 'Một nước thường quyết định ván cờ. Ở những thế này Đen dọa chiếu bí sau 2 nước và chỉ đúng một nước cứu được bạn: mọi nước khác đều thua.',
  },
  'u13l1.p': {
    en: 'Black threatens mate in 2. Only one move saves you.',
    vi: 'Đen dọa chiếu bí sau 2 nước. Chỉ một nước cứu được bạn.',
  },
  'u13l1.x': { en: 'That was the only move. Well defended!', vi: 'Đó là nước duy nhất. Phòng thủ rất tốt!' },
  'u13l2.title': { en: 'Quiet moves, full board', vi: 'Nước êm trên bàn cờ đầy' },
  'u13l2.e1': {
    en: 'With many pieces on the board, checks are easy to find but often lead nowhere. Look for the quiet move that adds an attacker or removes a defender.',
    vi: 'Khi bàn cờ còn nhiều quân, nước chiếu dễ tìm nhưng thường không đi đến đâu. Hãy tìm nước êm thêm một quân tấn công hoặc loại bỏ một quân phòng thủ.',
  },
  'u13l2.p': {
    en: 'Mate in 3 on a full board. Not every move is a check.',
    vi: 'Chiếu bí sau 3 nước trên bàn cờ đầy. Không phải nước nào cũng là nước chiếu.',
  },
  'u13l2.x': {
    en: 'A quiet move in the middle of the attack made the difference.',
    vi: 'Một nước êm giữa đòn tấn công đã tạo nên khác biệt.',
  },
  'u13l3.title': { en: 'Discovered attack in 3', vi: 'Chiếu mở trong 3 nước' },
  'u13l3.e1': {
    en: 'A discovered check is even stronger in a longer attack: while Black answers the check, the piece that moved takes up its best point for the next blow.',
    vi: 'Chiếu mở còn mạnh hơn trong đòn tấn công dài: trong lúc Đen đỡ nước chiếu, quân vừa đi chiếm điểm tốt nhất cho đòn tiếp theo.',
  },
  'u13l3.p': { en: 'Mate in 3. Start with a discovered check.', vi: 'Chiếu bí sau 3 nước. Hãy bắt đầu bằng một nước chiếu mở.' },
  'u13l3.x': {
    en: 'The discovered check gained a free move for your attack.',
    vi: 'Nước chiếu mở giúp đòn tấn công có thêm một nước miễn phí.',
  },

  'u14.title': { en: 'Mate in 4', vi: 'Chiếu bí sau 4 nước' },
  'u14.desc': {
    en: 'Four-move combinations against the best defence.',
    vi: 'Đòn phối hợp bốn nước trước cách phòng thủ tốt nhất.',
  },
  'u14l1.title': { en: 'Mate in 4', vi: 'Chiếu bí sau 4 nước' },
  'u14l1.e1': {
    en: 'Four moves deep: calculate Black’s best reply after each of your moves. Black always chooses the defence that lasts longest, so a line that works against a weak reply is not enough.',
    vi: 'Tính sâu bốn nước: sau mỗi nước của bạn, hãy tính nước đáp tốt nhất của Đen. Đen luôn chọn cách phòng thủ kéo dài nhất, nên một biến chỉ thắng được nước đáp yếu là chưa đủ.',
  },
  'u14l1.p': { en: 'Mate in 4 against the best defence.', vi: 'Chiếu bí sau 4 nước trước cách phòng thủ tốt nhất.' },
  'u14l1.x': {
    en: 'Four moves, and Black never escaped. Excellent calculation!',
    vi: 'Bốn nước, và Đen không bao giờ thoát được. Tính toán xuất sắc!',
  },
  'u14l2.title': { en: 'The quiet follow-up', vi: 'Nước êm giữa đòn' },
  'u14l2.e1': {
    en: 'Long attacks often need a pause: after a few checks, one quiet move brings the last piece in or takes away the last escape point. Black gets a free move, but nothing useful to do with it.',
    vi: 'Đòn tấn công dài thường cần một nhịp dừng: sau vài nước chiếu, một nước êm đưa quân cuối cùng vào trận hoặc lấy mất điểm thoát cuối cùng. Đen được đi một nước, nhưng không làm được gì hữu ích.',
  },
  'u14l2.p': {
    en: 'Mate in 4. Somewhere in the attack there is a quiet move.',
    vi: 'Chiếu bí sau 4 nước. Ở đâu đó trong đòn tấn công có một nước êm.',
  },
  'u14l2.x': {
    en: 'The quiet move in the middle was the key: Black had a free move and no defence.',
    vi: 'Nước êm ở giữa đòn là then chốt: Đen được đi tự do nhưng không có cách phòng thủ.',
  },

  // ---------- Master track ----------
  'u15.title': { en: 'Master play', vi: 'Đẳng cấp kiện tướng' },
  'u15.desc': {
    en: 'Quiet mates in 4, full-board attacks, and stopping a mate in 3.',
    vi: 'Chiếu bí 4 nước với nước êm, tấn công trên bàn cờ đầy, và chặn đòn chiếu bí sau 3 nước.',
  },
  'u15l1.title': { en: 'Quiet mate in 4', vi: 'Chiếu bí 4 nước với nước êm' },
  'u15l1.e1': {
    en: 'The hardest attacks contain a quiet move: no check, no capture, just a better point for a piece. Masters find it by asking what Black would do if they could pass.',
    vi: 'Những đòn tấn công khó nhất có một nước êm: không chiếu, không ăn quân, chỉ đưa một quân tới điểm tốt hơn. Kiện tướng tìm ra nó bằng cách tự hỏi Đen sẽ làm gì nếu được bỏ lượt.',
  },
  'u15l1.p': {
    en: 'Mate in 4. At least one of your moves is not a check.',
    vi: 'Chiếu bí sau 4 nước. Ít nhất một nước của bạn không phải nước chiếu.',
  },
  'u15l1.x': {
    en: 'You found the quiet move inside a four-move attack. Master level!',
    vi: 'Bạn đã tìm ra nước êm trong đòn tấn công bốn nước. Đẳng cấp kiện tướng!',
  },
  'u15l2.title': { en: 'Full-board mate in 4', vi: 'Chiếu bí 4 nước trên bàn cờ đầy' },
  'u15l2.e1': {
    en: 'Real games are crowded. With defenders everywhere, check which black pieces can block, capture or cover each point before you commit to an attack.',
    vi: 'Ván cờ thật thường đông quân. Khi quân phòng thủ ở khắp nơi, hãy kiểm tra quân Đen nào có thể chặn, ăn quân hay che từng điểm trước khi quyết định tấn công.',
  },
  'u15l2.p': { en: 'Mate in 4 on a full board.', vi: 'Chiếu bí sau 4 nước trên bàn cờ đầy.' },
  'u15l2.x': {
    en: 'Every defender was accounted for. Mate in 4!',
    vi: 'Mọi quân phòng thủ đều đã được tính đến. Chiếu bí sau 4 nước!',
  },
  'u15l3.title': { en: 'Master challenge', vi: 'Thử thách kiện tướng' },
  'u15l3.e1': {
    en: 'The final test mixes attack and defence, with no hint about which is which: first a mate in 3 to stop, then three mates in 4. Look at both sides’ threats before every move.',
    vi: 'Bài kiểm tra cuối kết hợp tấn công và phòng thủ, không báo trước đâu là đâu: đầu tiên chặn một đòn chiếu bí sau 3 nước, sau đó là ba đòn chiếu bí sau 4 nước. Hãy xem mối đe dọa của cả hai bên trước mỗi nước đi.',
  },
  'u15l3.p1': {
    en: 'Black threatens mate in 3. Only one move saves you.',
    vi: 'Đen dọa chiếu bí sau 3 nước. Chỉ một nước cứu được bạn.',
  },
  'u15l3.x1': {
    en: 'The only defence, three moves deep. Master level!',
    vi: 'Nước phòng thủ duy nhất, tính sâu ba nước. Đẳng cấp kiện tướng!',
  },
  'u15l3.p2': { en: 'Mate in 4 against the best defence.', vi: 'Chiếu bí sau 4 nước trước cách phòng thủ tốt nhất.' },
  'u15l3.x2': {
    en: 'Master challenge complete. Calculated to the end!',
    vi: 'Hoàn thành thử thách kiện tướng. Tính toán đến tận cùng!',
  },
} satisfies Record<string, Entry>;

export type MessageKey = keyof typeof messages;

export function hasMessage(key: string): key is MessageKey {
  return Object.hasOwn(messages, key);
}

/** Translate a key, filling {placeholders}. Unknown keys are returned as-is so gaps are visible. */
export function translate(lang: Language, key: string, vars?: Record<string, string | number>): string {
  const text = hasMessage(key) ? messages[key][lang] : key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text;
}
