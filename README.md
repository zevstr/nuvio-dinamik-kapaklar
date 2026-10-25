# Ozan · Nuvio Dinamik Kapaklar

Xperience profilindeki **6 koleksiyon, 57 klasör** için kendi kataloglarından yapım görselleri seçer. Katalog listelerini veya filtrelerini değiştirmez. Fotoğraflar yeniden üretilmez; yalnızca ölçeklenir, kırpılır ve sabit Türkçe tipografi eklenir. IMDB yazımı büyük harftir.

## Günlük seçim

- Türkiye saatiyle yaklaşık **06:17** kontrol edilir. Her gün zorunlu fotoğraf değişimi yapılmaz.
- Güncellik yalnızca En Yeniler seçimine ağırlık verir. Klasik film, tür ve seri koleksiyonlarında eski yapımlar elenmez.
- Katalogda sağlanıyorsa puan, oy sayısı ve popülerlik kullanılır. Bu alanlar yoksa uydurulmaz; kaynak sırası ve diğer mevcut bilgilerle değerlendirme yapılır.
- Yeni film kapaklarında kısa yapımlar; yeni dizi kapaklarında haber, talk-show ve reality içerikleri geri planda tutulur. Bu kural yalnızca görsel seçimini etkiler.
- Tercih gerçek yatay arka plan görselidir: en az 960×540, uygun en-boy oranı, yeterli kontrast ve detay. Dikey afiş kesilerek yatay kapak yapılmaz. Yüksek çözünürlük ayrıca puan kazandırır.
- Önceki seçilen yapım hâlâ listedeyse daha güçlü aday en az 12 puan öne geçmedikçe korunur. Önceki günlük sıralama yöntemi kaldırılmıştır.
- Otomatik ölçüler görselin anlamını, oyuncuyu veya üzerindeki yazıyı kusursuz anlayamaz. Kontrol sayfasında görsel inceleme yapılabilir. Sistem bir yüz tanıma ya da sanat yönetmenliği modeli değildir.

## Kategoriler

En Yeniler (7), IMDB Seçkileri (4), Hint Sineması (6), Ne İzlesem? (10), Keşfet (3), Film Serileri (20). Çok kaynaklı klasörlerin kendi kaynakları birleştirilir. En Yeniler için gerekirse en fazla dört katalog sayfası incelenir. Başka bir kategoriden dolgu fotoğrafı alınmaz.

## Yayın

[Canlı kontrol sayfası](https://zevstr.github.io/nuvio-dinamik-kapaklar/). Sabit dosyalar `covers/<slug>.jpg`, yazısız arka planlar `covers/<slug>-hero.jpg` biçimindedir. Görselin içeriğine göre sürümlenmiş kopya da oluşturulur. `status.json` yalnızca güvenli görsel seçim özetini taşır. Kaynak hatasında yeni dağıtım yapılmaz; önceki başarılı Pages yayını korunur.

GitHub Pages yanıtlarında 10 dakikalık HTTP önbelleği gözlendi. Nuvio cihazı daha uzun önbellek kullanabilir; gerçek cihazdaki otomatik yenilenme ayrıca doğrulanmalıdır. GitHub günlük işleri geciktirebilir veya uzun süre etkinlik olmayan public depolarda durdurabilir.

## Gizli ayar

`XPERIENCE_MANIFEST_URL`, GitHub Actions Repository Secret olarak saklanır. Özel kurulum bağlantısı kodda, herkese açık çıktıda ve hata mesajlarında yayınlanmaz. Bu bağlantı API anahtarları, geçmiş/scrobble ve varsa üye akışlarına erişim içerebilir. Kullanıcı bu depoda gizli ayar olarak saklanmasını açıkça onaylamıştır. Kod yalnızca katalog okur.

## Çalıştırma

Node.js 24, DejaVu Sans fontu. `npm ci --ignore-scripts`, `npm test`, gizli ayar ortamda mevcutken `npm run build`. GitHub Pages kaynağı GitHub Actions'tır. Elle çalışma: Actions → Günlük kapakları yenile → Run workflow.

Görseller ilgili yapımların hak sahiplerine aittir. Xperience katalogları TMDB verilerinden yararlanır; bu ürün TMDB tarafından onaylanmış veya sertifikalandırılmış değildir. [TMDB](https://www.themoviedb.org/). Bu sistem oynatma bağlantısı veya izlenebilirlik doğrulamaz.
