// Zeehn Lingo — Ingliz tili · Boshlang'ich (1-daraja)
// Mavzular ketma-ketligi boshlang'ich kurslarning odatiy tartibiga mos:
// salomlashish → maktab → o'yinchoqlar → tana → kasblar → bog' → oila → kiyim → uy →
// ovqat → do'stlar → hayvonlar → xona → harakatlar → dengiz bo'yi.
// Barcha so'zlar, gaplar va tarjimalar Zeehn jamoasi tomonidan yozilgan.
// Har bir dars: so'zlar [inglizcha, o'zbekcha] va gaplar [inglizcha, o'zbekcha] (+ ixtiyoriy qoida "tip").

export const COURSE = {
  id: "en-1",
  title: "Ingliz tili · Boshlang'ich",
  units: [
    {
      id: "u1",
      title: "Salom! Tanishuv",
      lessons: [
        { id: "l1", title: "Salomlashish", tip: "Hello — salom, Goodbye — xayr. Javob: I'm fine, thank you.",
          words: [["hello", "salom"], ["goodbye", "xayr"], ["fine", "yaxshi"], ["thank you", "rahmat"], ["how are you", "qalaysan / qalaysiz"]],
          sentences: [["Hello! How are you?", "Salom! Qalaysan?"], ["I'm fine, thank you.", "Men yaxshiman, rahmat."]] },
        { id: "l2", title: "Ismim va yoshim", tip: "What's your name? — Ismingiz nima? How old are you? — Necha yoshdasiz?",
          words: [["name", "ism"], ["my", "mening"], ["your", "sening / sizning"], ["what", "nima"], ["old", "yoshda (yosh)"]],
          sentences: [["What's your name?", "Ismingiz nima?"], ["My name is Aziz.", "Mening ismim Aziz."]] },
        { id: "l3", title: "Sonlar 1–5",
          words: [["one", "bir"], ["two", "ikki"], ["three", "uch"], ["four", "to'rt"], ["five", "besh"]],
          sentences: [["I'm five.", "Men besh yoshdaman."], ["One, two, three!", "Bir, ikki, uch!"]] },
        { id: "l4", title: "Sonlar 6–10",
          words: [["six", "olti"], ["seven", "yetti"], ["eight", "sakkiz"], ["nine", "to'qqiz"], ["ten", "o'n"]],
          sentences: [["How old are you?", "Necha yoshdasan?"], ["I'm eight.", "Men sakkiz yoshdaman."]] },
        { id: "l5", title: "Hafta kunlari", tip: "Hafta kunlari doim katta harf bilan yoziladi: Monday, Friday.",
          words: [["Monday", "dushanba"], ["Tuesday", "seshanba"], ["Wednesday", "chorshanba"], ["Thursday", "payshanba"], ["Friday", "juma"], ["Saturday", "shanba"], ["Sunday", "yakshanba"]],
          sentences: [["Today is Monday.", "Bugun dushanba."], ["I like Sunday.", "Men yakshanbani yaxshi ko'raman."]] },
        { id: "l6", title: "Kamalak ranglari",
          words: [["red", "qizil"], ["yellow", "sariq"], ["green", "yashil"], ["blue", "ko'k"], ["purple", "binafsha"]],
          sentences: [["It's red.", "U qizil."], ["My bag is blue.", "Mening sumkam ko'k."]] },
      ],
    },
    {
      id: "u2",
      title: "Maktab, o'yinchoqlar va tanam",
      lessons: [
        { id: "l7", title: "Bu nima?", tip: "What's this? — Bu nima? Javob: It's a pen. — Bu ruchka.",
          words: [["pen", "ruchka"], ["pencil", "qalam"], ["book", "kitob"], ["bag", "sumka"], ["ruler", "chizg'ich"]],
          sentences: [["What's this?", "Bu nima?"], ["It's a pencil.", "Bu qalam."]] },
        { id: "l8", title: "O'yinchoqlarim", tip: "Is this your ball? — Bu sening to'plingmi? Yes, it is. / No, it isn't.",
          words: [["ball", "to'p"], ["doll", "qo'g'irchoq"], ["car", "mashina"], ["teddy bear", "ayiqcha"], ["kite", "varrak"]],
          sentences: [["Is this your ball?", "Bu sening to'plingmi?"], ["Yes, it is.", "Ha, shunday."]] },
        { id: "l9", title: "Yuzim", tip: "Bitta narsa: This is my nose. Ko'p narsa: These are my eyes.",
          words: [["head", "bosh"], ["eyes", "ko'zlar"], ["ears", "quloqlar"], ["nose", "burun"], ["mouth", "og'iz"]],
          sentences: [["This is my nose.", "Bu mening burnim."], ["These are my eyes.", "Bular mening ko'zlarim."]] },
        { id: "l10", title: "Qo'l va oyoq",
          words: [["arm", "qo'l"], ["hand", "kaft (qo'l)"], ["leg", "oyoq"], ["foot", "oyoq panjasi"], ["hair", "soch"]],
          sentences: [["These are my arms.", "Bular mening qo'llarim."], ["This is my hand.", "Bu mening qo'lim."]] },
      ],
    },
    {
      id: "u3",
      title: "Kasblar, bog' va oila",
      lessons: [
        { id: "l11", title: "Kasblar", tip: "He's — u (erkak), She's — u (ayol). Is she a doctor? — U shifokormi?",
          words: [["teacher", "o'qituvchi"], ["doctor", "shifokor"], ["nurse", "hamshira"], ["farmer", "fermer"], ["driver", "haydovchi"]],
          sentences: [["She's a teacher.", "U o'qituvchi."], ["Is he a doctor?", "U shifokormi?"]] },
        { id: "l12", title: "Bog'da", tip: "in — ichida, on — ustida, under — ostida.",
          words: [["tree", "daraxt"], ["slide", "tepalik (sirpanchiq)"], ["swing", "arg'imchoq"], ["bench", "o'rindiq"], ["flower", "gul"]],
          sentences: [["Where's the ball?", "To'p qayerda?"], ["It's under the tree.", "U daraxt ostida."]] },
        { id: "l13", title: "Oilam", tip: "'s — egalik: Ali's bag — Alining sumkasi.",
          words: [["mother", "ona"], ["father", "ota"], ["brother", "aka / uka"], ["sister", "opa / singil"], ["family", "oila"]],
          sentences: [["This is my mother.", "Bu mening onam."], ["It's Ali's bag.", "Bu Alining sumkasi."]] },
        { id: "l14", title: "Bobo va buvi",
          words: [["grandmother", "buvi"], ["grandfather", "bobo"], ["baby", "chaqaloq"], ["aunt", "xola / amma"], ["uncle", "tog'a / amaki"]],
          sentences: [["Who's this?", "Bu kim?"], ["It's my grandfather.", "Bu mening bobom."]] },
      ],
    },
    {
      id: "u4",
      title: "Kiyim, uy va tushlik",
      lessons: [
        { id: "l15", title: "Kiyimlarim", tip: "his — uning (o'g'il), her — uning (qiz). Are these his socks?",
          words: [["T-shirt", "futbolka"], ["socks", "paypoq"], ["trousers", "shim"], ["shoes", "tufli / oyoq kiyim"], ["hat", "shlyapa / bosh kiyim"]],
          sentences: [["This is her T-shirt.", "Bu uning futbolkasi."], ["Are these his shoes?", "Bular uning tuflilarimi?"]] },
        { id: "l16", title: "Uyim", tip: "Is she in the kitchen? — U oshxonadami?",
          words: [["kitchen", "oshxona"], ["bedroom", "yotoqxona"], ["bathroom", "hammom"], ["living room", "mehmonxona"], ["garden", "bog' (hovli)"]],
          sentences: [["Is she in the kitchen?", "U oshxonadami?"], ["Dad is in the garden.", "Dadam bog'da."]] },
        { id: "l17", title: "Tushlik qutim", tip: "a — undoshdan oldin (a banana), an — unlidan oldin (an apple).",
          words: [["sandwich", "buterbrod"], ["apple", "olma"], ["banana", "banan"], ["orange", "apelsin"], ["juice", "sharbat"]],
          sentences: [["I've got an apple.", "Menda olma bor."], ["I haven't got a banana.", "Menda banan yo'q."]] },
      ],
    },
    {
      id: "u5",
      title: "Do'stlar, hayvonlar va ovqat",
      lessons: [
        { id: "l18", title: "Do'stim", tip: "She's got long hair. — Uning sochi uzun.",
          words: [["friend", "do'st"], ["long", "uzun"], ["short", "qisqa / past"], ["tall", "baland bo'yli"], ["glasses", "ko'zoynak"]],
          sentences: [["She's got long hair.", "Uning sochi uzun."], ["He's got glasses.", "Uning ko'zoynagi bor."]] },
        { id: "l19", title: "Shakllar",
          words: [["circle", "doira"], ["square", "kvadrat"], ["triangle", "uchburchak"], ["star", "yulduz"], ["heart", "yurak"]],
          sentences: [["It's a big star.", "Bu katta yulduz."], ["It's got a heart.", "Unda yurak bor."]] },
        { id: "l20", title: "Hayvonot bog'i", tip: "I like — yoqtiraman, I don't like — yoqtirmayman.",
          words: [["elephant", "fil"], ["monkey", "maymun"], ["lion", "sher"], ["giraffe", "jirafa"], ["snake", "ilon"]],
          sentences: [["I like monkeys.", "Men maymunlarni yoqtiraman."], ["I don't like snakes.", "Men ilonlarni yoqtirmayman."]] },
        { id: "l21", title: "Ovqatlar", tip: "Do you like fish? — Baliqni yoqtirasanmi? Yes, I do. / No, I don't.",
          words: [["carrot", "sabzi"], ["rice", "guruch"], ["fish", "baliq"], ["meat", "go'sht"], ["milk", "sut"]],
          sentences: [["Do you like carrots?", "Sabzini yoqtirasanmi?"], ["Yes, I do.", "Ha, yoqtiraman."]] },
      ],
    },
    {
      id: "u6",
      title: "Xonam, harakatlar va dengiz",
      lessons: [
        { id: "l22", title: "Xonam", tip: "There's — bor (bitta), There are — bor (ko'p).",
          words: [["bed", "karavot"], ["chair", "stul"], ["table", "stol"], ["lamp", "chiroq"], ["window", "deraza"]],
          sentences: [["There's a lamp on the table.", "Stol ustida chiroq bor."], ["There are two chairs.", "Ikkita stul bor."]] },
        { id: "l23", title: "Sonlar 11–20",
          words: [["eleven", "o'n bir"], ["twelve", "o'n ikki"], ["fifteen", "o'n besh"], ["eighteen", "o'n sakkiz"], ["twenty", "yigirma"]],
          sentences: [["There are twelve books.", "O'n ikkita kitob bor."], ["I've got twenty pencils.", "Menda yigirmata qalam bor."]] },
        { id: "l24", title: "Men nima qila olaman?", tip: "I can — qila olaman, I can't — qila olmayman.",
          words: [["run", "yugurmoq"], ["swim", "suzmoq"], ["jump", "sakramoq"], ["climb", "tirmashmoq"], ["fly", "uchmoq"]],
          sentences: [["I can swim.", "Men suza olaman."], ["Can you fly? No, I can't.", "Ucha olasanmi? Yo'q, ucha olmayman."]] },
        { id: "l25", title: "Dengiz bo'yida", tip: "Let's — qani, ...aylik: Let's play! — Qani, o'ynaymiz!",
          words: [["sea", "dengiz"], ["sand", "qum"], ["shell", "chig'anoq"], ["boat", "qayiq"], ["sun", "quyosh"]],
          sentences: [["Let's play ball!", "Qani, to'p o'ynaymiz!"], ["Let's swim in the sea.", "Qani, dengizda suzamiz."]] },
      ],
    },
  ],
};

// Darajalar — Learning Path bo'limlari bo'yicha
export const LEVELS = [
  { id: "beginner", name: "Beginner", units: ["u1", "u2"] },
  { id: "elementary", name: "Elementary", units: ["u3", "u4"] },
  { id: "intermediate", name: "Intermediate", units: ["u5", "u6"] },
];
COURSE.levels = LEVELS;

export const LESSON_IDS = COURSE.units.flatMap((u) => u.lessons.map((l) => l.id));
export const WORDS = Object.fromEntries(
  COURSE.units.flatMap((u) => u.lessons.flatMap((l) => l.words.map(([en, uz]) => [en.toLowerCase(), { en, uz, lesson: l.id }])))
);
