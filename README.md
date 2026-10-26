# Ozan · Nuvio Dinamik Kapaklar

Xperience profilindeki **6 koleksiyon, 57 klasör** için kendi kataloglarından yapım görselleri seçer. Kapakların yanında son yedi günde bölümü yayınlanan yerli ve yabancı dizi katalogları üretir. Bu iki katalog bölüm tarihine göre süzülür; diğer katalogların içerik filtreleri Xperience tarafından yönetilir. Fotoğraflar yeniden üretilmez; yalnızca ölçeklenir, kırpılır ve sabit Türkçe tipografi eklenir. IMDB yazımı büyük harftir.

## Ortak Türkçe afiş sağlayıcısı

`src/library-posters.mjs`, `covers.json` kaynaklarını ve güncel Xperience manifestindeki film/dizi kataloglarını birlikte tarar. Tekrarlanan IMDb kimlikleri tek afişte birleştirilir. Adres şablonu: `https://zevstr.github.io/nuvio-dinamik-kapaklar/art/{type}/{imdb_id}.jpg`.

Gerçek afiş yalnızca TMDB'de birebir IMDb kimliğiyle ve doğru film/dizi türünde tek eşleşen kayıttan alınır. Görsellerde yanlış yapımlara yönlenebilen genel görsel CDN eşleştirmesi kullanılmaz. Türkçe tür ve yalnızca Cinemeta'nın açık `imdbRating` alanı eklenir. TMDB puanı IMDB diye etiketlenmez; doğrulanamayan puan boş kalır. Genel afişlerde listeye özgü sıra, bölüm veya doğrulanmamış ses/altyazı etiketleri bulunmaz. Gündemdeki Filmler ve son 7 gün kataloglarının özel afişleri kendi sıralama/bölüm bilgisini korur.

Bu bir istek anında çalışan sunucu değildir. Kapsam, yapılandırılmış kaynakların taranan sayfalarıdır (normal kataloglarda ilk sayfa, IMDB 250'de mevcut çok sayfalı tarama). IMDb kimliği olmayan veya taranan sayfalara henüz girmeyen yapımlar kapsanmaz. Xperience sağlayıcı zincirinin orijinal görsele dönüşü canlı doğrulanmadan genel sağlayıcı değiştirilmemelidir. HTTP 200 dönen bir boş kapak üretilmez; eksik dosya 404 kalır.

Tarama Türkiye 06.00/16.00 planında çalışır; görsel ve puan önbelleği 24 saattir. `.poster-cache` GitHub Actions önbelleğinde saklanır, git'e eklenmez. Tekil yenileme hatasında önbellekteki son başarılı afiş korunur. Yaygın hata veya boyut sınırı yeni Pages dağıtımını durdurur, önceki yayın korunur. `art/status.json` kapsamı, hazır/yenilenen/korunan/başarısız sayılarını açıklar; özel manifest bağlantısı veya API anahtarı yayınlanmaz.

## Kapak fotoğrafı seçimi

- Türkiye saatiyle yaklaşık **06:00 ve 16:00** kontrol edilir. Her gün zorunlu fotoğraf değişimi yapılmaz.
- Güncellik yalnızca En Yeniler seçimine ağırlık verir. Klasik film, tür ve seri koleksiyonlarında eski yapımlar elenmez.
- Katalogda sağlanıyorsa puan, oy sayısı ve popülerlik kullanılır. Bu alanlar yoksa uydurulmaz; kaynak sırası ve diğer mevcut bilgilerle değerlendirme yapılır.
- Yeni film kapaklarında kısa yapımlar; yeni dizi kapaklarında haber, talk-show ve reality içerikleri geri planda tutulur. Bu kural yalnızca görsel seçimini etkiler.
- Tercih gerçek yatay arka plan görselidir: en az 960×540, uygun en-boy oranı, yeterli kontrast ve detay. Dikey afiş kesilerek yatay kapak yapılmaz. Yüksek çözünürlük ayrıca puan kazandırır.
- Önceki seçilen yapım hâlâ listedeyse daha güçlü aday en az 12 puan öne geçmedikçe korunur. Önceki günlük sıralama yöntemi kaldırılmıştır.
- Otomatik ölçüler görselin anlamını, oyuncuyu veya üzerindeki yazıyı kusursuz anlayamaz. Kontrol sayfasında görsel inceleme yapılabilir. Sistem bir yüz tanıma ya da sanat yönetmenliği modeli değildir.

## Kategoriler

En Yeniler (7), IMDB Seçkileri (5), Hint Sineması (8), Ne İzlesem? (14), Keşfet (3), Film Serileri (20). Çok kaynaklı klasörlerin kendi kaynakları birleştirilir. En Yeniler için gerekirse en fazla dört katalog sayfası incelenir. Başka bir kategoriden dolgu fotoğrafı alınmaz.

## Yayın

[Canlı kontrol sayfası](https://zevstr.github.io/nuvio-dinamik-kapaklar/). Sabit dosyalar `covers/<slug>.jpg`, yazısız arka planlar `covers/<slug>-hero.jpg` biçimindedir. Görselin içeriğine göre sürümlenmiş kopya da oluşturulur. `status.json` yalnızca güvenli görsel seçim özetini taşır. Kaynak hatasında yeni dağıtım yapılmaz; önceki başarılı Pages yayını korunur.

GitHub Pages yanıtlarında 10 dakikalık HTTP önbelleği gözlendi. Nuvio cihazı daha uzun önbellek kullanabilir; gerçek cihazdaki otomatik yenilenme ayrıca doğrulanmalıdır. GitHub günlük işleri geciktirebilir veya uzun süre etkinlik olmayan public depolarda durdurabilir.

## Gizli ayar

`XPERIENCE_MANIFEST_URL`, GitHub Actions Repository Secret olarak saklanır. Özel kurulum bağlantısı kodda, herkese açık çıktıda ve hata mesajlarında yayınlanmaz. Bu bağlantı API anahtarları, geçmiş/scrobble ve varsa üye akışlarına erişim içerebilir. Kullanıcı bu depoda gizli ayar olarak saklanmasını açıkça onaylamıştır. Kod katalog ve dizi bölüm ayrıntılarını okur; oynatma veya hesap değişikliği yapmaz.

## Çalıştırma

Node.js 24, DejaVu Sans fontu. `npm ci --ignore-scripts`, `npm test`, gizli ayar ortamda mevcutken `npm run build`. GitHub Pages kaynağı GitHub Actions'tır. Elle çalışma: Actions → Günlük kapakları yenile → Run workflow.

Görseller ilgili yapımların hak sahiplerine aittir. Xperience katalogları TMDB verilerinden yararlanır; bu ürün TMDB tarafından onaylanmış veya sertifikalandırılmış değildir. [TMDB](https://www.themoviedb.org/). Bu sistem oynatma bağlantısı veya izlenebilirlik doğrulamaz.

## Son 7 gün listelerinin güvenilirliği

En fazla 80 yerli ve 240 diğer aday, dört eşzamanlı istekle incelenir; bu bir dünya yayın takviminin tamamı değildir. Bölüm tarihleri son 168 saat içinde olmalıdır. Gelecek bölümler ve özel bölümler dışarıda kalır. Geçici ayrıntı hatası bir kez yeniden denenir. Aday kaynakları tamamen boşsa veya ayrıntı hataları hem beşi hem adayların %25'ini aşarsa eksik dağıtım yapılmaz; önceki başarılı yayın korunur. Bu durumda listeler son başarılı taramanın tarihini temsil eder. Kontrol sayfası son tarama saatini, hata ve kurtarılan istek sayılarını gösterir; 36 saatten eski taramada uyarır.

Kapak alt yazıları TV için 54 px, kalın beyaz ve koyu zeminlidir; uzun açıklamalar kısaltılır. Günlük güncelleme başarısı cihaz görsel önbelleğinin yenilendiği anlamına gelmez.

### Türkçe film afişi denemesi
Günlük üretim `trending_movies` kataloğunun ilk 100 IMDb kimlikli filmi için
`posters/movie/{imdb_id}.jpg` dosyalarını oluşturur. Orijinal afişin üzerine Türkçe
tür ve yalnızca Cinemeta'nın açık `imdbRating` alanından alınan 10 üzerinden puan
basılır. Eksik puan gösterilmez; TMDB/katalog karma puanı IMDb diye etiketlenmez.
`GÜNDEMDE` rozeti katalog üyeliğidir; günlük sıralama veya izlenebilirlik iddiası
değildir. Bu aşama sadece Gündemdeki Filmler satırında denenir. Yeni katalog
üyelerinin afişi bir sonraki günlük üretime kadar mevcut sağlayıcıya düşebilir.
Önizleme: `/posters/`; üretim denetimi: `/posters/status.json`.

Türkçe afişler ayrıca `/posters/manifest.json` üzerinden bağımsız bir katalog
olarak sunulur. Xperience'a imported add-on olarak eklenir; satırın Poster art
ayarı **Original** olmalıdır, böylece hazır Türkçe afiş başka sağlayıcı tarafından
yeniden işlenmez. Eski `trending_movies` satırı Discover only olarak korunur;
günlük üretimin veri kaynağı olmaya devam eder. Her başarılı üretim afiş
bağlantısına sürüm ekleyerek görsel önbelleğini yeniler. Genel poster sağlayıcısı
ve diğer koleksiyonların afiş ayarları değiştirilmez.

### Gerçek TMDB trend rozetleri
Üst rozetler TMDB günlük ilk 100 sırasını, günlük listede olmayanlar için haftalık
ilk 100 sırasını gösterir. Yerel katalogdaki konum rozet için kullanılmaz; gizleme
ve filtreleme gerçek TMDB numaralarını değiştirmez. Trend listesinde doğrulanmış
IMDb eşleşmesi yoksa rozet çizilmez. IMDb puanı ayrı alt şeritte kalır.

Üretim için GitHub Actions repository secret `TMDB_READ_ACCESS_TOKEN` gerekir.
Değer TMDB hesabındaki **API Read Access Token** olmalıdır. Token yalnızca
`api.themoviedb.org` sunucusuna Authorization başlığında gönderilir; URL'lere,
kaynak koda ve kamuya açık durum dosyalarına yazılmaz. Anahtar eksik veya API
verisi doğrulanamıyorsa üretim durur ve önceki yayın korunur. İlk 100 sınırı günlük
ve haftalık liste için ayrı ayrı uygulanır. Bu geliştirme anahtar eklenip canlı
API ile kontrol edilene kadar ayrı geliştirme dalında tutulur.

Gündemdeki Filmler artık doğrudan TMDB günlük ilk 20 filminden üretilir. Xperience seçkisi kullanılmaz. Eksik IMDb kimliği veya afiş üretimi yayını durdurur; önceki yayın korunur.

Katalog yanıtları cacheMaxAge: 3600 bildirir; Xperience içe aktarılan listeleri bir saatlik önbellekle yenileyebilir. GitHub zamanlanmış işler gecikebilir. Cihaz önbelleği ek gecikme yaratabilir.
