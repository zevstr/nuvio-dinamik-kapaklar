# Ozan · Nuvio Dinamik Kapaklar

Xperience profilindeki **6 koleksiyon, 57 klasör** için kendi kataloglarından yapım görselleri seçer. Kapakların yanında son yedi günde bölümü yayınlanan yerli ve yabancı dizi katalogları üretir. Bu iki katalog bölüm tarihine göre süzülür; diğer katalogların içerik filtreleri Xperience tarafından yönetilir. Fotoğraflar yeniden üretilmez; yalnızca ölçeklenir, kırpılır ve sabit Türkçe tipografi eklenir. IMDB yazımı büyük harftir.

## Günlük seçim

- Türkiye saatiyle yaklaşık **06:17** kontrol edilir. Her gün zorunlu fotoğraf değişimi yapılmaz.
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
