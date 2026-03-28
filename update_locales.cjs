const fs = require('fs');
const path = require('path');

const localesDir = 'c:/Users/ibrah/.gemini/antigravity/scratch/streaming-app/pstream-frontend/locales';
const files = fs.readdirSync(localesDir);

const translations = {
    "it": {
        "viewingActivity": "Attività di visione",
        "viewingActivitySub": "Gestisci la cronologia delle visioni e le valutazioni",
        "privacy": "Privacy e dati personali",
        "privacySub": "Gestisci l'uso delle tue informazioni personali",
        "profileTransfer": "Trasferimento profilo",
        "profileTransferSub": "Copia questo profilo su un altro account",
        "account": "Account",
        "manageAccount": "Gestisci Account",
        "manageAccountSub": "Gestisci la tua identità e sincronizzazione",
        "deleteDataTitle": "Elimina i tuoi dati",
        "deleteDataDesc": "Questo rimuoverà permanentemente la tua cronologia, le liste e le impostazioni dai nostri server e da questo browser.",
        "deleteDataConfirm": "Sei sicuro di voler eliminare tutti i tuoi dati? L'operazione non può essere annullata.",
        "deleteDataButton": "Elimina permanentemente i miei dati",
        "viewingHistoryEmpty": "La tua cronologia è attualmente vuota.",
        "viewingHistoryTitle": "Attività recente",
        "transferTitle": "Trasferisci Profilo",
        "transferDesc": "La tua identità P-Stream è portatile. Usa la tua frase di recupero da 12 parole per accedere su qualsiasi dispositivo e il tuo profilo ti seguirà automaticamente."
    },
    "es": {
        "viewingActivity": "Actividad de visionado",
        "viewingActivitySub": "Gestionar historial y calificaciones",
        "privacy": "Privacidad y datos",
        "privacySub": "Gestionar el uso de información personal",
        "profileTransfer": "Transferencia de perfil",
        "profileTransferSub": "Copiar este perfil a otra cuenta",
        "account": "Cuenta",
        "manageAccount": "Gestionar cuenta",
        "manageAccountSub": "Gestionar tu identidad y sincronización",
        "deleteDataTitle": "Eliminar tus datos",
        "deleteDataDesc": "Esto eliminará permanentemente tu historial, listas y ajustes de nuestros servidores y de este navegador.",
        "deleteDataConfirm": "¿Seguro que quieres eliminar todos tus datos? Esta acción no se puede deshacer.",
        "deleteDataButton": "Eliminar mis datos permanentemente",
        "viewingHistoryEmpty": "Tu historial de visionado está vacío.",
        "viewingHistoryTitle": "Actividad reciente",
        "transferTitle": "Transferir Perfil",
        "transferDesc": "Tu identidad de p-stream es portátil. Usa tu frase de 12 palabras en cualquier dispositivo y tu perfil te seguirá automáticamente."
    },
    "fr": {
        "viewingActivity": "Activité de visionnage",
        "viewingActivitySub": "Gérer l'historique et les évaluations",
        "privacy": "Confidentialité et données",
        "privacySub": "Gérer l'utilisation des informations personnelles",
        "profileTransfer": "Transfert de profil",
        "profileTransferSub": "Copier ce profil vers un autre compte",
        "account": "Compte",
        "manageAccount": "Gérer le compte",
        "manageAccountSub": "Gérer votre identité et synchronisation",
        "deleteDataTitle": "Supprimer vos données",
        "deleteDataDesc": "Cela supprimera définitivement votre historique, vos listes et vos paramètres.",
        "deleteDataConfirm": "Voulez-vous vraiment supprimer toutes vos données ? Cette action est irréversible.",
        "deleteDataButton": "Supprimer définitivement mes données",
        "viewingHistoryEmpty": "Votre historique est vide.",
        "viewingHistoryTitle": "Activité récente",
        "transferTitle": "Transférer le profil",
        "transferDesc": "Votre identité p-stream est portable. Utilisez votre phrase de 12 mots pour vous connecter sur n'importe quel appareil."
    },
    "de": {
        "viewingActivity": "Titel-Verlauf",
        "viewingActivitySub": "Verlauf und Bewertungen verwalten",
        "privacy": "Datenschutz",
        "privacySub": "Nutzung persönlicher Daten verwalten",
        "profileTransfer": "Profil-Transfer",
        "profileTransferSub": "Dieses Profil in ein anderes Konto kopieren",
        "account": "Konto",
        "manageAccount": "Konto verwalten",
        "manageAccountSub": "Identität und Synchronisierung verwalten",
        "deleteDataTitle": "Daten löschen",
        "deleteDataDesc": "Dies wird Ihren Verlauf, Listen und Einstellungen dauerhaft löschen.",
        "deleteDataConfirm": "Sind Sie sicher, dass Sie alle Ihre Daten löschen möchten? Dies kann nicht rückgängig gemacht werden.",
        "deleteDataButton": "Meine Daten dauerhaft löschen",
        "viewingHistoryEmpty": "Ihr Verlauf ist derzeit leer.",
        "viewingHistoryTitle": "Kürzliche Aktivitäten",
        "transferTitle": "Profil übertragen",
        "transferDesc": "Ihre p-stream-Identität ist portabel. Verwenden Sie Ihre 12-Wörter-Phrase, um sich auf jedem Gerät anzumelden."
    },
    "pt": {
        "viewingActivity": "Atividade de visualização",
        "viewingActivitySub": "Gerir histórico e classificações",
        "privacy": "Privacidade e dados",
        "privacySub": "Gerir a utilização de informações pessoais",
        "profileTransfer": "Transferência de perfil",
        "profileTransferSub": "Copiar este perfil para outra conta",
        "account": "Conta",
        "manageAccount": "Gerir conta",
        "manageAccountSub": "Gerir a sua identidade e sincronização",
        "deleteDataTitle": "Eliminar os seus dados",
        "deleteDataDesc": "Isto irá remover permanentemente o seu histórico, listas e definições.",
        "deleteDataConfirm": "Tem a certeza que deseja eliminar todos os seus dados? Esta ação não pode ser desfeita.",
        "deleteDataButton": "Eliminar permanentemente os meus dados",
        "viewingHistoryEmpty": "O seu histórico está vazio.",
        "viewingHistoryTitle": "Atividade recente",
        "transferTitle": "Transferir Perfil",
        "transferDesc": "A sua identidade p-stream é portátil. Utilize a sua frase de 12 palavras para iniciar sessão em qualquer dispositivo."
    },
    "tr": {
        "viewingActivity": "İzleme Etkinliği",
        "viewingActivitySub": "İzleme geçmişini ve puanlamaları yönet",
        "privacy": "Gizlilik ve veri ayarları",
        "privacySub": "Kişisel bilgi kullanımını yönet",
        "profileTransfer": "Profil transferi",
        "profileTransferSub": "Bu profili başka bir hesaba kopyala",
        "account": "Hesap",
        "manageAccount": "Hesabı Yönet",
        "manageAccountSub": "Kimliğinizi ve senkronizasyonu yönetin",
        "deleteDataTitle": "Verilerinizi silin",
        "deleteDataDesc": "Bu, geçmişinizi, listelerinizi ve ayarlarınızı kalıcı olarak kaldıracaktır.",
        "deleteDataConfirm": "Tüm verilerinizi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.",
        "deleteDataButton": "Verilerimi Kalıcı Olarak Sil",
        "viewingHistoryEmpty": "İzleme geçmişiniz şu anda boş.",
        "viewingHistoryTitle": "Son Etkinlik",
        "transferTitle": "Profili Transfer Et",
        "transferDesc": "p-stream kimliğiniz taşınabilirdir. Herhangi bir cihazda oturum açmak için 12 kelimelik kurtarma ifadenizi kullanın."
    },
    "ru": {
        "viewingActivity": "История просмотров",
        "viewingActivitySub": "Управление историей просмотров и оценками",
        "privacy": "Конфиденциальность и данные",
        "privacySub": "Управление использованием личных данных",
        "profileTransfer": "Перенос профиля",
        "profileTransferSub": "Скопировать этот профиль в другую учетную запись",
        "account": "Аккаунт",
        "manageAccount": "Управление аккаунтом",
        "manageAccountSub": "Управление личностью и синхронизацией",
        "deleteDataTitle": "Удалить ваши данные",
        "deleteDataDesc": "Это навсегда удалит вашу историю, списки и настройки.",
        "deleteDataConfirm": "Вы уверены, что хотите удалить все свои данные? Это действие нельзя отменить.",
        "deleteDataButton": "Навсегда удалить мои данные",
        "viewingHistoryEmpty": "Ваша история просмотров пуста.",
        "viewingHistoryTitle": "Недавняя активность",
        "transferTitle": "Перенести профиль",
        "transferDesc": "Ваша личность p-stream портативна. Используйте свою фразу из 12 слов для входа на любом устройстве."
    },
    "ar": {
        "viewingActivity": "نشاط المشاهدة",
        "viewingActivitySub": "إدارة سجل المشاهدة والتقييمات",
        "privacy": "إعدادات الخصوصية والبيانات",
        "privacySub": "إدارة استخدام المعلومات الشخصية",
        "profileTransfer": "نقل الملف الشخصي",
        "profileTransferSub": "نسخ هذا الملف الشخصي إلى حساب آخر",
        "account": "الحساب",
        "manageAccount": "إدارة الحساب",
        "manageAccountSub": "إدارة هويتك والمزامنة",
        "deleteDataTitle": "حذف بياناتك",
        "deleteDataDesc": "سيؤدي هذا إلى حذف السجل والقوائم والإعدادات بشكل دائم.",
        "deleteDataConfirm": "هل أنت متأكد أنك تريد حذف جميع بياناتك؟ لا يمكن التراجع عن هذا الإجراء.",
        "deleteDataButton": "حذف بياناتي نهائياً",
        "viewingHistoryEmpty": "سجل المشاهدة الخاص بك فارغ حالياً.",
        "viewingHistoryTitle": "النشاط الأخير",
        "transferTitle": "نقل الملف الشخصي",
        "transferDesc": "هوية p-stream الخاصة بك محمولة. استخدم عبارة الاسترداد المكونة من 12 كلمة لتسجيل الدخول على أي جهاز."
    },
    "ja": {
        "viewingActivity": "マイアクティビティ",
        "viewingActivitySub": "視聴履歴と評価の管理",
        "privacy": "プライバシーとデータ設定",
        "privacySub": "個人情報の使用を管理",
        "profileTransfer": "プロフィールの移行",
        "profileTransferSub": "このプロフィールを別のアカウントにコピー",
        "account": "アカウント",
        "manageAccount": "アカウントの管理",
        "manageAccountSub": "IDと言語の同期を管理",
        "deleteDataTitle": "データの削除",
        "deleteDataDesc": "これにより、履歴、リスト、設定が完全に削除されます。",
        "deleteDataConfirm": "すべてのデータを削除してもよろしいですか？この操作は取り消せません。",
        "deleteDataButton": "データを完全に削除する",
        "viewingHistoryEmpty": "視聴履歴がありません。",
        "viewingHistoryTitle": "最近のアクティビティ",
        "transferTitle": "プロフィールの移行",
        "transferDesc": "p-streamのIDは持ち運び可能です。12語の復元フレーズを使用して、任意のデバイスでサインインしてください。"
    },
    "ko": {
        "viewingActivity": "시청 기록",
        "viewingActivitySub": "시청 기록 및 평점 관리",
        "privacy": "개인정보 및 데이터 설정",
        "privacySub": "개인정보 사용 관리",
        "profileTransfer": "프로필 이전",
        "profileTransferSub": "이 프로필을 다른 계정으로 복사",
        "account": "계정",
        "manageAccount": "계정 관리",
        "manageAccountSub": "ID 및 동기화 관리",
        "deleteDataTitle": "데이터 삭제",
        "deleteDataDesc": "기록, 리스트 및 설정이 영구적으로 삭제됩니다.",
        "deleteDataConfirm": "모든 데이터를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.",
        "deleteDataButton": "내 데이터 영구 삭제",
        "viewingHistoryEmpty": "시청 기록이 없습니다.",
        "viewingHistoryTitle": "최근 활동",
        "transferTitle": "프로필 이전",
        "transferDesc": "p-stream ID는 이식 가능합니다. 12단어 복구 문구로 모든 기기에서 로그인할 수 있습니다."
    },
    "zh": {
        "viewingActivity": "观影活动",
        "viewingActivitySub": "管理观影历史和评分",
        "privacy": "隐私和数据设置",
        "privacySub": "管理个人信息的使用",
        "profileTransfer": "个人资料转移",
        "profileTransferSub": "将此个人资料复制到另一个帐户",
        "account": "帐户",
        "manageAccount": "管理帐户",
        "manageAccountSub": "管理您的身份和同步",
        "deleteDataTitle": "删除您的数据",
        "deleteDataDesc": "这将永久删除您的历史记录、列表和设置。",
        "deleteDataConfirm": "您确定要删除所有数据吗？此操作无法撤销。",
        "deleteDataButton": "永久删除我的数据",
        "viewingHistoryEmpty": "您的观影历史目前为空。",
        "viewingHistoryTitle": "最近活动",
        "transferTitle": "转移个人资料",
        "transferDesc": "您的 p-stream 身份是可移植的。使用您的 12 个单词的恢复短语在任何设备上登录。"
    },
    "hi": {
        "viewingActivity": "देखने की गतिविधि",
        "viewingActivitySub": "इतिहास और रेटिंग प्रबंधित करें",
        "privacy": "गोपनीयता और डेटा सेटिंग्स",
        "privacySub": "व्यक्तिगत जानकारी के उपयोग को प्रबंधित करें",
        "profileTransfer": "प्रोफ़ाइल स्थानांतरण",
        "profileTransferSub": "इस प्रोफ़ाइल को दूसरे खाते में कॉपी करें",
        "account": "खाता",
        "manageAccount": "खाता प्रबंधित करें",
        "manageAccountSub": "अपनी पहचान और समन्वय प्रबंधित करें",
        "deleteDataTitle": "अपना डेटा हटाएं",
        "deleteDataDesc": "यह आपके इतिहास, सूचियों और सेटिंग्स को स्थायी रूप से हटा देगा।",
        "deleteDataConfirm": "क्या आप वाकई अपना सारा डेटा हटाना चाहते हैं? इसे पूर्ववत नहीं किया जा सकता।",
        "deleteDataButton": "मेरा डेटा स्थायी रूप से हटाएं",
        "viewingHistoryEmpty": "आपकी देखने की गतिविधि अभी खाली है।",
        "viewingHistoryTitle": "हालिया गतिविधि",
        "transferTitle": "प्रोफ़ाइल स्थानांतरित करें",
        "transferDesc": "आपकी p-stream पहचान पोर्टेबल है। किसी भी डिवाइस पर साइन इन करने के लिए अपने 12-शब्दों के वाक्यांश का उपयोग करें।"
    },
    "pl": {
        "viewingActivity": "Historia oglądania",
        "viewingActivitySub": "Zarządzaj historią i ocenami",
        "privacy": "Prywatność i dane",
        "privacySub": "Zarządzaj wykorzystaniem danych osobowych",
        "profileTransfer": "Transfer profilu",
        "profileTransferSub": "Skopiuj ten profil na inne konto",
        "account": "Konto",
        "manageAccount": "Zarządzaj kontem",
        "manageAccountSub": "Zarządzaj tożsamością i synchronizacją",
        "deleteDataTitle": "Usuń dane",
        "deleteDataDesc": "To trwale usunie historię, listy i ustawienia.",
        "deleteDataConfirm": "Czy na pewno chcesz usunąć wszystkie swoje dane? Tego nie da się cofnąć.",
        "deleteDataButton": "Trwale usuń moje dane",
        "viewingHistoryEmpty": "Twoja historia oglądania jest pusta.",
        "viewingHistoryTitle": "Ostatnia aktywność",
        "transferTitle": "Przenieś profil",
        "transferDesc": "Twoja tożsamość p-stream jest przenośna. Użyj swojej 12-wyrazowej frazy, aby zalogować się na dowolnym urządzeniu."
    },
    "nl": {
        "viewingActivity": "Kijkactiviteit",
        "viewingActivitySub": "Beheer kijkgeschiedenis en beoordelingen",
        "privacy": "Privacy- en gegevensinstellingen",
        "privacySub": "Beheer het gebruik van persoonlijke informatie",
        "profileTransfer": "Profieloverdracht",
        "profileTransferSub": "Kopieer dit profiel naar een ander account",
        "account": "Account",
        "manageAccount": "Account beheren",
        "manageAccountSub": "Beheer je identiteit en synchronisatie",
        "deleteDataTitle": "Gegevens verwijderen",
        "deleteDataDesc": "Dit verwijdert permanent je geschiedenis, lijsten en instellingen.",
        "deleteDataConfirm": "Weet je zeker dat je al je gegevens wilt verwijderen? Dit kan niet ongedaan worden gemaakt.",
        "deleteDataButton": "Mijn gegevens permanent verwijderen",
        "viewingHistoryEmpty": "Je kijkgeschiedenis is momenteel leeg.",
        "viewingHistoryTitle": "Recente activiteit",
        "transferTitle": "Profiel overdragen",
        "transferDesc": "Je p-stream-identiteit is draagbaar. Gebruik je herstelzin van 12 woorden om op elk apparaat in te loggen."
    },
    "sv": {
        "viewingActivity": "Visningsaktivitet",
        "viewingActivitySub": "Hantera visningshistorik och betyg",
        "privacy": "Sekretess- och datainställningar",
        "privacySub": "Hantera användning av personlig information",
        "profileTransfer": "Profilöverföring",
        "profileTransferSub": "Kopiera denna profil till ett annat konto",
        "account": "Konto",
        "manageAccount": "Hantera konto",
        "manageAccountSub": "Hantera din identitet och synkronisering",
        "deleteDataTitle": "Radera dina data",
        "deleteDataDesc": "Detta kommer att ta bort din historik, listor och inställningar permanent.",
        "deleteDataConfirm": "Är du säker på att du vill radera alla dina data? Detta kan inte ångras.",
        "deleteDataButton": "Radera mina data permanent",
        "viewingHistoryEmpty": "Din visningshistorik är för närvarande tom.",
        "viewingHistoryTitle": "Senaste aktivitet",
        "transferTitle": "Överför profil",
        "transferDesc": "Din p-stream-identitet är portabel. Använd din 12-ords återställningsfras för att logga in på valfri enhet."
    }
};

files.forEach(file => {
    if (!file.endsWith('.json')) return;
    const lang = file.split('.')[0];
    const filePath = path.join(localesDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Inject missing keys into settings
    if (!content.settings) content.settings = {};
    const t = translations[lang] || translations['en'] || {};
    
    // Always use English as baseline if lang missing
    const base = translations[lang] || {};

    Object.keys(translations['it']).forEach(key => { // Using 'it' as keyset since it was the first I drafted
        if (!content.settings[key]) {
             content.settings[key] = base[key] || translations['it'][key]; // Fallback to IT if somehow missing (shouldn't be)
        }
    });

    // Remove legacy Kids mentions from nav if they exist
    if (content.nav) {
        delete content.nav.exitKids;
        delete content.nav.switchToKids;
    }
    
    // Remove kids from rows
    if (content.rows) {
        delete content.rows.kidsPlayful;
        delete content.rows.kidsFamily;
        delete content.rows.kidsAdventures;
        delete content.rows.kidsFamilyMovies;
    }

    fs.writeFileSync(filePath, JSON.stringify(content, null, 4), 'utf8');
    console.log(`Updated ${file}`);
});
