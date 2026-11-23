// Zeehn Lingo — Ingliz tili A1 kursi (birinchi versiya)
// Har bir dars: 5 ta yangi so'z [inglizcha, o'zbekcha] va 2 ta gap [inglizcha, o'zbekcha].
// Mashqlar shu ma'lumotlardan avtomatik tuziladi.

export const COURSE = {
  id: "en-a1",
  title: "Ingliz tili · A1",
  units: [
    {
      id: "u1",
      title: "Salomlashish va tanishuv",
      lessons: [
        { id: "l1", title: "Salom!", words: [["hello", "salom"], ["goodbye", "xayr"], ["yes", "ha"], ["no", "yo'q"], ["thank you", "rahmat"]],
          sentences: [["Yes, thank you.", "Ha, rahmat."], ["No, thank you.", "Yo'q, rahmat."]] },
        { id: "l2", title: "Ismim…", words: [["name", "ism"], ["my", "mening"], ["your", "sening"], ["friend", "do'st"], ["good", "yaxshi"]],
          sentences: [["My name is Aziz.", "Mening ismim Aziz."], ["You are my friend.", "Sen mening do'stimsan."]] },
        { id: "l3", title: "Men, sen, biz", words: [["I", "men"], ["you", "sen / siz"], ["he", "u (erkak)"], ["she", "u (ayol)"], ["we", "biz"]],
          sentences: [["I am Aziz.", "Men Azizman."], ["We are friends.", "Biz do'stlarmiz."]] },
        { id: "l4", title: "Xayrli tong", words: [["morning", "ertalab"], ["good morning", "xayrli tong"], ["night", "tun"], ["good night", "xayrli tun"], ["how are you", "qalaysiz"]],
          sentences: [["Good morning, Madina!", "Xayrli tong, Madina!"], ["I am good, thank you.", "Men yaxshiman, rahmat."]] },
        { id: "l5", title: "Maktabda", words: [["student", "o'quvchi"], ["teacher", "o'qituvchi"], ["school", "maktab"], ["book", "kitob"], ["pen", "ruchka"]],
          sentences: [["I am a student.", "Men o'quvchiman."], ["She is a teacher.", "U o'qituvchi."]] },
      ],
    },
    {
      id: "u2",
      title: "Oila va sonlar",
      lessons: [
        { id: "l6", title: "Oilam", words: [["mother", "ona"], ["father", "ota"], ["brother", "aka / uka"], ["sister", "opa / singil"], ["family", "oila"]],
          sentences: [["This is my mother.", "Bu mening onam."], ["I love my family.", "Men oilamni sevaman."]] },
        { id: "l7", title: "Bobo va buvi", words: [["son", "o'g'il"], ["daughter", "qiz (farzand)"], ["baby", "chaqaloq"], ["grandmother", "buvi"], ["grandfather", "bobo"]],
          sentences: [["This is my grandfather.", "Bu mening bobom."], ["She has a baby.", "Uning chaqalog'i bor."]] },
        { id: "l8", title: "1 dan 5 gacha", words: [["one", "bir"], ["two", "ikki"], ["three", "uch"], ["four", "to'rt"], ["five", "besh"]],
          sentences: [["I have two sisters.", "Mening ikkita opam bor."], ["We have three books.", "Bizda uchta kitob bor."]] },
        { id: "l9", title: "6 dan 10 gacha", words: [["six", "olti"], ["seven", "yetti"], ["eight", "sakkiz"], ["nine", "to'qqiz"], ["ten", "o'n"]],
          sentences: [["I am ten.", "Men o'n yoshdaman."], ["She has seven pens.", "Uning yettita ruchkasi bor."]] },
        { id: "l10", title: "Katta va kichik", words: [["big", "katta"], ["small", "kichik"], ["old", "keksa / eski"], ["young", "yosh"], ["happy", "baxtli"]],
          sentences: [["My family is big.", "Mening oilam katta."], ["The baby is happy.", "Chaqaloq baxtli."]] },
      ],
    },
    {
      id: "u3",
      title: "Ovqat va ranglar",
      lessons: [
        { id: "l11", title: "Dasturxon", words: [["water", "suv"], ["bread", "non"], ["tea", "choy"], ["milk", "sut"], ["apple", "olma"]],
          sentences: [["I want water.", "Men suv xohlayman."], ["Tea, please.", "Choy, iltimos."]] },
        { id: "l12", title: "Yeyman, ichaman", words: [["eat", "yemoq"], ["drink", "ichmoq"], ["want", "xohlamoq"], ["like", "yoqtirmoq"], ["food", "ovqat"]],
          sentences: [["I like tea.", "Men choyni yoqtiraman."], ["We eat bread.", "Biz non yeymiz."]] },
        { id: "l13", title: "Nonushta", words: [["breakfast", "nonushta"], ["lunch", "tushlik"], ["dinner", "kechki ovqat"], ["egg", "tuxum"], ["rice", "guruch"]],
          sentences: [["I eat eggs for breakfast.", "Men nonushtaga tuxum yeyman."], ["We eat rice for lunch.", "Biz tushlikka guruch yeymiz."]] },
        { id: "l14", title: "Ranglar", words: [["red", "qizil"], ["green", "yashil"], ["yellow", "sariq"], ["white", "oq"], ["black", "qora"]],
          sentences: [["The apple is red.", "Olma qizil."], ["I like green tea.", "Men ko'k choyni yoqtiraman."]] },
        { id: "l15", title: "Mazali!", words: [["hot", "issiq"], ["cold", "sovuq"], ["sweet", "shirin"], ["delicious", "mazali"], ["hungry", "och (qorni och)"]],
          sentences: [["The tea is hot.", "Choy issiq."], ["I am hungry.", "Men ochman."]] },
      ],
    },
    {
      id: "u4",
      title: "Kundalik hayot",
      lessons: [
        { id: "l16", title: "Bugun va ertaga", words: [["day", "kun"], ["today", "bugun"], ["tomorrow", "ertaga"], ["week", "hafta"], ["time", "vaqt"]],
          sentences: [["Today is a good day.", "Bugun yaxshi kun."], ["See you tomorrow.", "Ertaga ko'rishguncha."]] },
        { id: "l17", title: "Harakatlar", words: [["go", "bormoq"], ["come", "kelmoq"], ["read", "o'qimoq"], ["write", "yozmoq"], ["speak", "gapirmoq"]],
          sentences: [["I read a book.", "Men kitob o'qiyman."], ["We speak English.", "Biz inglizcha gapiramiz."]] },
        { id: "l18", title: "Shaharda", words: [["home", "uy"], ["city", "shahar"], ["street", "ko'cha"], ["shop", "do'kon"], ["park", "bog' (park)"]],
          sentences: [["I go home.", "Men uyga boraman."], ["The shop is big.", "Do'kon katta."]] },
        { id: "l19", title: "Ish va o'yin", words: [["work", "ishlamoq"], ["play", "o'ynamoq"], ["sleep", "uxlamoq"], ["run", "yugurmoq"], ["study", "o'rganmoq"]],
          sentences: [["Children play in the park.", "Bolalar bog'da o'ynaydi."], ["I sleep at night.", "Men tunda uxlayman."]] },
        { id: "l20", title: "Ob-havo", words: [["sun", "quyosh"], ["rain", "yomg'ir"], ["snow", "qor"], ["weather", "ob-havo"], ["wind", "shamol"]],
          sentences: [["The weather is cold today.", "Bugun ob-havo sovuq."], ["The sun is hot.", "Quyosh issiq."]] },
      ],
    },
  ],
};

// Darajalar (XP bo'yicha)
export const TIERS = [
  { name: "Boshlovchi", xp: 0 },
  { name: "Shogird", xp: 100 },
  { name: "Mohir", xp: 300 },
  { name: "Usta", xp: 700 },
  { name: "Chempion", xp: 1500 },
];

export const LESSON_IDS = COURSE.units.flatMap((u) => u.lessons.map((l) => l.id));
export const WORDS = Object.fromEntries(
  COURSE.units.flatMap((u) => u.lessons.flatMap((l) => l.words.map(([en, uz]) => [en.toLowerCase(), { en, uz, lesson: l.id }])))
);
