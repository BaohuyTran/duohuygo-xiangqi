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
  'home.unit': { en: 'Unit {n}', vi: 'Chương {n}' },
  'home.progress': { en: '{done} of {total} lessons complete', vi: 'Đã xong {done}/{total} bài' },
  'home.lessonState.locked': { en: 'locked', vi: 'chưa mở' },
  'home.lessonState.available': { en: 'start', vi: 'bắt đầu' },
  'home.lessonState.completed': { en: 'completed', vi: 'đã hoàn thành' },
  'home.start': { en: 'Start', vi: 'Bắt đầu' },
  'home.reset': { en: 'Reset progress', vi: 'Xóa tiến độ' },
  'home.resetConfirm': { en: 'Reset all lesson progress?', vi: 'Xóa toàn bộ tiến độ học?' },
  'home.allDone': { en: 'You finished every lesson. Great work!', vi: 'Bạn đã học xong tất cả các bài. Tuyệt vời!' },

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

  // ---------- Unit 1: the board and the General ----------
  'u1.title': { en: 'The board and the General', vi: 'Bàn cờ và quân Tướng' },
  'u1.desc': { en: 'Points, river, palace, and the most important piece.', vi: 'Giao điểm, sông, cung và quân quan trọng nhất.' },
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
  'u1l1.e5': { en: 'Now tap all 9 points of Black’s palace.', vi: 'Giờ hãy chạm vào cả 9 điểm trong cung của bên Đen.' },

  'u1l2.title': { en: 'The General', vi: 'Quân Tướng' },
  'u1l2.e1': {
    en: 'The General (帥) moves one point up, down, left or right. Never diagonally.',
    vi: 'Tướng (帥) đi một điểm lên, xuống, sang trái hoặc phải. Không bao giờ đi chéo.',
  },
  'u1l2.e2': {
    en: 'The General can never leave the palace. From a corner it has only two moves.',
    vi: 'Tướng không bao giờ được ra khỏi cung. Ở góc cung, Tướng chỉ có hai nước đi.',
  },
  'u1l2.e3': { en: 'Tap every point the General can move to.', vi: 'Chạm vào mọi điểm Tướng có thể đi tới.' },
  'u1l2.e4': { en: 'Tap every point the General can move to.', vi: 'Chạm vào mọi điểm Tướng có thể đi tới.' },
  'u1l2.e5': { en: 'Move the General to the marked point.', vi: 'Đưa Tướng tới điểm được đánh dấu.' },

  'u1l3.title': { en: 'Capturing and safety', vi: 'Ăn quân và an toàn' },
  'u1l3.e1': {
    en: 'Pieces capture by moving onto an enemy piece. The General captures the same way it moves.',
    vi: 'Quân cờ ăn quân bằng cách đi vào điểm có quân đối phương. Tướng ăn quân giống như cách nó đi.',
  },
  'u1l3.e2': { en: 'Capture the black Soldier with your General.', vi: 'Dùng Tướng ăn quân Tốt đen.' },
  'u1l3.e3': {
    en: 'Never move the General onto a point an enemy attacks. Here the black Chariot controls a whole line.',
    vi: 'Không bao giờ đưa Tướng vào điểm bị đối phương tấn công. Ở đây Xe đen khống chế cả một đường.',
  },
  'u1l3.e4': {
    en: 'Tap every point the General can safely move to.',
    vi: 'Chạm vào mọi điểm Tướng có thể đi tới an toàn.',
  },
  'u1l3.e5': {
    en: 'Your General is attacked by a Chariot. Move it to the only safe point.',
    vi: 'Tướng của bạn bị Xe tấn công. Hãy đưa Tướng tới điểm an toàn duy nhất.',
  },

  // ---------- Unit 2: Advisor and Elephant ----------
  'u2.title': { en: 'Advisor and Elephant', vi: 'Sĩ và Tượng' },
  'u2.desc': { en: 'The General’s bodyguards.', vi: 'Những vệ sĩ của Tướng.' },
  'u2l1.title': { en: 'The Advisor', vi: 'Quân Sĩ' },
  'u2l1.e1': {
    en: 'The Advisor (仕) moves one point diagonally and never leaves the palace.',
    vi: 'Sĩ (仕) đi chéo một điểm và không bao giờ ra khỏi cung.',
  },
  'u2l1.e2': {
    en: 'From a corner of the palace, the Advisor can only go back to the centre.',
    vi: 'Từ góc cung, Sĩ chỉ có thể quay về điểm giữa cung.',
  },
  'u2l1.e3': { en: 'Tap every point the Advisor can move to.', vi: 'Chạm vào mọi điểm Sĩ có thể đi tới.' },
  'u2l1.e4': { en: 'Tap every point the Advisor can move to.', vi: 'Chạm vào mọi điểm Sĩ có thể đi tới.' },
  'u2l1.e5': { en: 'Move the Advisor to the marked point.', vi: 'Đưa Sĩ tới điểm được đánh dấu.' },

  'u2l2.title': { en: 'The Elephant', vi: 'Quân Tượng' },
  'u2l2.e1': {
    en: 'The Elephant (相) moves exactly two points diagonally, across the corner of a square.',
    vi: 'Tượng (相) đi chéo đúng hai điểm, theo đường chéo của một ô vuông lớn.',
  },
  'u2l2.e2': {
    en: 'Elephants can never cross the river. Standing on the river bank, only the backward moves remain.',
    vi: 'Tượng không bao giờ được qua sông. Khi đứng ở bờ sông, Tượng chỉ còn các nước lùi.',
  },
  'u2l2.e3': { en: 'Tap every point the Elephant can move to.', vi: 'Chạm vào mọi điểm Tượng có thể đi tới.' },
  'u2l2.e4': { en: 'Tap every point the Elephant can move to.', vi: 'Chạm vào mọi điểm Tượng có thể đi tới.' },
  'u2l2.e5': { en: 'Move the Elephant to the marked point.', vi: 'Đưa Tượng tới điểm được đánh dấu.' },

  'u2l3.title': { en: 'The Elephant’s eye', vi: 'Mắt Tượng' },
  'u2l3.e1': {
    en: 'The point in the middle of an Elephant move is its “eye”. If any piece stands there, that move is blocked.',
    vi: 'Điểm ở giữa đường đi của Tượng gọi là “mắt Tượng”. Nếu có quân nào đứng ở đó, Tượng không đi được hướng đó (cản mắt Tượng).',
  },
  'u2l3.e2': {
    en: 'Two eyes are blocked. Tap every point the Elephant can still reach.',
    vi: 'Hai mắt Tượng bị cản. Chạm vào mọi điểm Tượng vẫn đi tới được.',
  },
  'u2l3.e3': { en: 'Elephants capture too. Take the black Horse.', vi: 'Tượng cũng ăn được quân. Hãy ăn quân Mã đen.' },
  'u2l3.e4': {
    en: 'Two Soldiers are in reach, but one is protected by the black Chariot. Make the safe capture.',
    vi: 'Có hai quân Tốt trong tầm, nhưng một quân được Xe đen bảo vệ. Hãy ăn quân an toàn.',
  },

  // ---------- Unit 3: Chariot and Horse ----------
  'u3.title': { en: 'Chariot and Horse', vi: 'Xe và Mã' },
  'u3.desc': { en: 'The strongest piece, and the trickiest one.', vi: 'Quân mạnh nhất và quân khó đoán nhất.' },
  'u3l1.title': { en: 'The Chariot', vi: 'Quân Xe' },
  'u3l1.e1': {
    en: 'The Chariot (俥) slides any number of points in a straight line until something is in the way. It is the strongest piece.',
    vi: 'Xe (俥) đi thẳng bao nhiêu điểm cũng được cho tới khi gặp vật cản. Đây là quân mạnh nhất.',
  },
  'u3l1.e2': {
    en: 'Tap every point the Chariot can move to. It can’t pass your own pieces.',
    vi: 'Chạm vào mọi điểm Xe có thể đi tới. Xe không đi xuyên qua quân của mình.',
  },
  'u3l1.e3': { en: 'Slide the Chariot to the marked point across the river.', vi: 'Đưa Xe qua sông tới điểm được đánh dấu.' },
  'u3l1.e4': { en: 'Capture the black Cannon with your Chariot.', vi: 'Dùng Xe ăn quân Pháo đen.' },
  'u3l1.e5': {
    en: 'The black Horse is protected by the black Chariot. Find the capture that wins material.',
    vi: 'Mã đen được Xe đen bảo vệ. Hãy tìm nước ăn quân có lợi.',
  },

  'u3l2.title': { en: 'The Horse', vi: 'Quân Mã' },
  'u3l2.e1': {
    en: 'The Horse (傌) moves one point straight, then one point diagonally outward: an L shape.',
    vi: 'Mã (傌) đi thẳng một điểm rồi chéo ra ngoài một điểm, tạo thành hình chữ L (Mã đi chữ nhật).',
  },
  'u3l2.e2': {
    en: 'Near the edge of the board the Horse has fewer moves.',
    vi: 'Ở gần mép bàn cờ, Mã có ít nước đi hơn.',
  },
  'u3l2.e3': { en: 'Tap every point the Horse can move to.', vi: 'Chạm vào mọi điểm Mã có thể đi tới.' },
  'u3l2.e4': { en: 'Tap every point the Horse can move to.', vi: 'Chạm vào mọi điểm Mã có thể đi tới.' },
  'u3l2.e5': { en: 'Move the Horse to the marked point.', vi: 'Đưa Mã tới điểm được đánh dấu.' },

  'u3l3.title': { en: 'The Horse’s leg', vi: 'Cản chân Mã' },
  'u3l3.e1': {
    en: 'The first, straight step is the Horse’s “leg”. If any piece stands there, the Horse can’t go that way. Here your Soldier blocks two moves.',
    vi: 'Bước đi thẳng đầu tiên là “chân Mã”. Nếu có quân đứng ở đó, Mã không đi được hướng ấy (bị cản chân). Ở đây Tốt của bạn cản hai nước.',
  },
  'u3l3.e2': {
    en: 'Two legs are blocked. Tap every point the Horse can still reach.',
    vi: 'Hai chân Mã bị cản. Chạm vào mọi điểm Mã vẫn đi tới được.',
  },
  'u3l3.e3': { en: 'Tap every point this Horse can move to.', vi: 'Chạm vào mọi điểm quân Mã này có thể đi tới.' },
  'u3l3.e4': {
    en: 'Win the biggest piece you can. Watch out for blocked legs!',
    vi: 'Hãy ăn quân lớn nhất có thể. Cẩn thận chân Mã bị cản!',
  },

  // ---------- Unit 4: Cannon ----------
  'u4.title': { en: 'The Cannon', vi: 'Quân Pháo' },
  'u4.desc': { en: 'A piece that captures by jumping.', vi: 'Quân ăn bằng cách nhảy qua ngòi.' },
  'u4l1.title': { en: 'How the Cannon moves', vi: 'Cách Pháo di chuyển' },
  'u4l1.e1': {
    en: 'When it is not capturing, the Cannon (炮) moves exactly like a Chariot: any distance in a straight line.',
    vi: 'Khi không ăn quân, Pháo (炮) đi giống hệt Xe: đi thẳng bao xa cũng được.',
  },
  'u4l1.e2': {
    en: 'Tap every point the Cannon can move to without capturing.',
    vi: 'Chạm vào mọi điểm Pháo có thể đi tới (không ăn quân).',
  },
  'u4l1.e3': {
    en: 'Move the Cannon to the centre file, a favourite first move.',
    vi: 'Đưa Pháo vào đường giữa (Pháo đầu), một nước khai cuộc rất phổ biến.',
  },
  'u4l1.e4': {
    en: 'The Cannon can’t capture a piece directly in front of it. With nothing in between, the black Chariot is safe.',
    vi: 'Pháo không ăn được quân đứng ngay trước mặt. Không có quân ở giữa nên Xe đen vẫn an toàn.',
  },

  'u4l2.title': { en: 'The screen', vi: 'Ngòi Pháo' },
  'u4l2.e1': {
    en: 'To capture, the Cannon jumps over exactly one piece (the “screen”) and lands on the enemy piece behind it.',
    vi: 'Để ăn quân, Pháo phải nhảy qua đúng một quân (gọi là “ngòi”) và ăn quân đối phương phía sau.',
  },
  'u4l2.e2': {
    en: 'Capture with the Cannon. Remember: it needs a screen.',
    vi: 'Dùng Pháo ăn quân. Nhớ rằng Pháo cần có ngòi.',
  },
  'u4l2.e3': {
    en: 'Tap every point the Cannon can move to, including captures.',
    vi: 'Chạm vào mọi điểm Pháo có thể đi tới, kể cả nước ăn quân.',
  },
  'u4l2.e4': {
    en: 'Your own piece can be the screen too. Win the black Chariot.',
    vi: 'Quân của mình cũng làm ngòi được. Hãy ăn Xe đen.',
  },

  'u4l3.title': { en: 'Cannon attacks', vi: 'Pháo tấn công' },
  'u4l3.e1': {
    en: 'A Cannon on the marked point would attack the black General, using the black Advisor as its screen.',
    vi: 'Nếu Pháo đứng ở điểm được đánh dấu, nó sẽ chiếu Tướng đen, dùng Sĩ đen làm ngòi.',
  },
  'u4l3.e2': { en: 'Give check with the Cannon.', vi: 'Dùng Pháo chiếu Tướng.' },
  'u4l3.e3': {
    en: 'Tap every point the Cannon can move to, including captures.',
    vi: 'Chạm vào mọi điểm Pháo có thể đi tới, kể cả nước ăn quân.',
  },
  'u4l3.e4': {
    en: 'Checkmate in one move with your two Cannons.',
    vi: 'Chiếu bí trong một nước bằng hai quân Pháo.',
  },

  // ---------- Unit 5: Soldier ----------
  'u5.title': { en: 'The Soldier', vi: 'Quân Tốt' },
  'u5.desc': { en: 'Small, but stronger after crossing the river.', vi: 'Nhỏ bé, nhưng mạnh lên khi qua sông.' },
  'u5l1.title': { en: 'Before the river', vi: 'Trước khi qua sông' },
  'u5l1.e1': {
    en: 'The Soldier (兵) moves one point forward. Before crossing the river, that is its only move.',
    vi: 'Tốt (兵) đi tiến một điểm. Khi chưa qua sông, đó là nước đi duy nhất của nó.',
  },
  'u5l1.e2': { en: 'Tap every point the Soldier can move to.', vi: 'Chạm vào mọi điểm Tốt có thể đi tới.' },
  'u5l1.e3': {
    en: 'Soldiers capture the way they move. Take the black Soldier.',
    vi: 'Tốt ăn quân theo cách nó đi. Hãy ăn quân Tốt đen.',
  },
  'u5l1.e4': { en: 'Push the Soldier across the river.', vi: 'Đưa Tốt qua sông.' },

  'u5l2.title': { en: 'After the river', vi: 'Sau khi qua sông' },
  'u5l2.e1': {
    en: 'Once across the river, the Soldier may also step left or right. It never moves backward.',
    vi: 'Khi đã qua sông, Tốt được đi ngang sang trái hoặc phải. Tốt không bao giờ đi lùi.',
  },
  'u5l2.e2': { en: 'Tap every point the Soldier can move to.', vi: 'Chạm vào mọi điểm Tốt có thể đi tới.' },
  'u5l2.e3': { en: 'Tap every point the Soldier can move to.', vi: 'Chạm vào mọi điểm Tốt có thể đi tới.' },
  'u5l2.e4': {
    en: 'On the last row the Soldier can only move sideways.',
    vi: 'Ở hàng cuối cùng, Tốt chỉ có thể đi ngang.',
  },
  'u5l2.e5': {
    en: 'Your Soldier can capture forward or sideways. Win the most valuable piece.',
    vi: 'Tốt có thể ăn tiến hoặc ăn ngang. Hãy ăn quân giá trị nhất.',
  },

  'u5l3.title': { en: 'Soldiers attack', vi: 'Tốt tấn công' },
  'u5l3.e1': {
    en: 'Crossed Soldiers attack sideways too. Together, Soldiers can trap the General.',
    vi: 'Tốt đã qua sông tấn công cả hai bên. Phối hợp với nhau, các quân Tốt có thể vây bắt Tướng.',
  },
  'u5l3.e2': { en: 'Give check with a Soldier.', vi: 'Dùng Tốt chiếu Tướng.' },
  'u5l3.e3': { en: 'Tap every point this Soldier attacks.', vi: 'Chạm vào mọi điểm quân Tốt này khống chế.' },
  'u5l3.e4': { en: 'Checkmate in one move.', vi: 'Chiếu bí trong một nước.' },

  // ---------- Unit 6: Flying general, check and checkmate ----------
  'u6.title': { en: 'Check and checkmate', vi: 'Chiếu và chiếu bí' },
  'u6.desc': { en: 'Facing Generals, check, and how to win.', vi: 'Lộ mặt Tướng, chiếu Tướng và cách giành chiến thắng.' },
  'u6l1.title': { en: 'Facing Generals', vi: 'Lộ mặt Tướng' },
  'u6l1.e1': {
    en: 'The two Generals may never face each other on the same line with nothing in between. Moving to the marked point would do that, so it isn’t allowed.',
    vi: 'Hai Tướng không bao giờ được đối mặt trên cùng một đường dọc mà không có quân nào ở giữa (lộ mặt Tướng). Đi tới điểm được đánh dấu sẽ gây ra điều đó nên không được phép.',
  },
  'u6l1.e2': {
    en: 'Tap every point the General can move to. Don’t let the Generals face each other!',
    vi: 'Chạm vào mọi điểm Tướng có thể đi tới. Đừng để hai Tướng đối mặt!',
  },
  'u6l1.e3': {
    en: 'A piece standing alone between the Generals is pinned: if it moved away, the Generals would face each other. This Horse can’t move at all.',
    vi: 'Quân duy nhất đứng giữa hai Tướng bị ghim: nếu nó đi ra, hai Tướng sẽ đối mặt. Quân Mã này không đi được nước nào.',
  },
  'u6l1.e4': {
    en: 'Checkmate in one! Your General controls its whole line, so use it.',
    vi: 'Chiếu bí trong một nước! Tướng của bạn khống chế cả đường dọc, hãy tận dụng điều đó.',
  },

  'u6l2.title': { en: 'Check', vi: 'Chiếu Tướng' },
  'u6l2.e1': {
    en: 'Your General is in check: the black Chariot attacks it. You must deal with check at once. The dots show the escapes.',
    vi: 'Tướng của bạn đang bị chiếu: Xe đen đang tấn công. Bạn phải xử lý ngay. Các chấm xanh là đường thoát.',
  },
  'u6l2.e2': { en: 'Give check with the Chariot.', vi: 'Dùng Xe chiếu Tướng.' },
  'u6l2.e3': {
    en: 'The black Horse gives check. Make any move that gets your General to safety.',
    vi: 'Mã đen đang chiếu. Hãy đi một nước bất kỳ để Tướng được an toàn.',
  },
  'u6l2.e4': { en: 'You are in check. Capture the attacker!', vi: 'Bạn đang bị chiếu. Hãy ăn quân đang chiếu!' },
  'u6l2.e5': {
    en: 'In check again. Tap every point the General can escape to.',
    vi: 'Lại bị chiếu. Chạm vào mọi điểm Tướng có thể chạy tới.',
  },

  'u6l3.title': { en: 'Checkmate', vi: 'Chiếu bí' },
  'u6l3.e1': {
    en: 'Checkmate: the black General is in check and has no legal move to escape. Red wins!',
    vi: 'Chiếu bí: Tướng đen bị chiếu và không còn nước nào để thoát. Bên Đỏ thắng!',
  },
  'u6l3.e2': { en: 'Checkmate in one with your two Chariots.', vi: 'Chiếu bí trong một nước bằng hai Xe.' },
  'u6l3.e3': {
    en: 'Checkmate in one with Horse and Cannon, a classic pattern.',
    vi: 'Chiếu bí trong một nước bằng Mã và Pháo (thế Mã hậu Pháo).',
  },
  'u6l3.e4': {
    en: 'In Xiangqi, a side with no legal moves loses, even when it is not in check. Black is to move here and is stuck, so Red wins.',
    vi: 'Trong cờ tướng, bên hết nước đi sẽ thua, kể cả khi không bị chiếu. Ở đây đến lượt Đen nhưng không còn nước đi, nên bên Đỏ thắng.',
  },
  'u6l3.e5': { en: 'Checkmate in one with a Soldier.', vi: 'Chiếu bí trong một nước bằng quân Tốt.' },
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
