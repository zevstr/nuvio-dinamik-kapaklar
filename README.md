# Ozan · Nuvio Dinamik Kapaklar

Xperience'taki **En Yeniler** koleksiyonunun yedi klasörü için kendi güncel kataloğundan gerçek görsel seçer. Fotoğrafın üzerine sabit Türkçe tipografi yerleştirir. İnsan yüzleri veya sahneler yapay zekâ ile yeniden üretilmez.

Kapsam: Yerli Diziler · Yeni Bölüm, Yeni Filmler · Dijitalde, Yeni Diziler, Yabancı Diziler · Yeni Bölüm, Yeni Türk Filmleri, Yeni Hint Filmleri · Tümü ve Yeni Hint · Kaliteli. Her kapak kendi katalog kimliğini kullanır; kaliteli Hint listesi diğer Hint listesinin kopyası değildir.

## Durum

İlk canlı katalog okuma ve GitHub Pages yayını 24 Ekim 2026'da başarılı oldu. [Canlı kapak](https://zevstr.github.io/nuvio-dinamik-kapaklar/). Nuvio cihazındaki görsel önbelleği ayrıca doğrulanmalıdır.

## Kurulum

1. GitHub Pages ayarlarında kaynak **GitHub Actions** seçilir.
2. **Settings → Secrets and variables → Actions → New repository secret** altında `XPERIENCE_MANIFEST_URL` eklenir. Değeri Xperience profilinin **Finalize → Manual setup → Install by URL** alanındaki HTTPS kurulum bağlantısıdır. Bağlantıyı kaynak koda, issue'lara veya README'ye yapıştırmayın.
3. **Actions → Günlük kapakları yenile → Run workflow** çalıştırılır.
4. Yayın başarılı olduğunda Pages sayfasındaki kapak bağlantısı Xperience klasörüne eklenir. Koleksiyon Ozan Nuvio profiline gönderilir.

**Özel bağlantının kapsamı:** Xperience kurulum bağlantısı API anahtarları, geçmiş satırları, scrobble ve varsa üye akışları için erişim içerebilir. Bu bağlantıyı GitHub Actions gizli ayarı olarak saklamak, bu depoda çalışan iş akışına erişim vermektir. Kod yalnızca katalog okur; yine de bağlantıyı eklemeden önce bu paylaşımın onaylanması gerekir. Mevcut bağlantı değişirse gizli ayar da güncellenmelidir.

## Davranış

- Günlük plan: Türkiye saatiyle yaklaşık **06:17**. Elle de çalıştırılabilir. GitHub zamanlamayı geciktirebilir; etkin olmayan public depolarda zamanlanmış işler durdurulabilir.
- Elle çalıştırmada `rotation_offset=1`, aynı gün içindeki önbellek denemesi için sıradaki güncel yapımın görselini seçer. Zamanlanmış çalışmalarda değer her zaman 0'dır; gerçek güncelleme tarihi değiştirilmez.
- Listeler yeniden oluşturulmaz: `covers.json` içindeki yedi Xperience katalog yanıtı okunur. Dil, yıl, kalite ve dijital yayın filtrelerinin sorumluluğu Xperience profilindedir. Yeni Hint Filmleri · Tümü kataloğu ülke IN seçimiyle tüm Hint dillerini içermelidir.
- En güncel ilk sekiz içeriğin içinden güne göre bir yapım seçilir. Görsel yoksa aynı güncel listedeki bir sonraki yapım denenir. Eski yıllardan dolgu yapılmaz.
- Kaynak fotoğraf sadece kırpılır/ölçeklenir; renkler, oyuncular ve yüzler yeniden üretilmez.
- Katalog gerçekten boşsa eski film göstermek yerine kalıcı tipografiyle bekleme kapağı yayınlanır. Bağlantı veya görsel üretimi hatalıysa yeni dağıtım yapılmaz; önceki başarılı Pages yayını kalır. Son güncelleme tarihi kontrol sayfasındadır.
- Sabit görsel dosyaları `covers/<slug>.jpg`, yazısız hero dosyaları `covers/<slug>-hero.jpg` biçimindedir. Kontrol sayfası ayrıca içeriğe göre sürümlenmiş dosyayı kullanır. GitHub Pages yanıtlarında 10 dakikalık HTTP önbelleği gözlendi. Nuvio sabit URL'yi daha uzun önbelleğe alabilir; gerçek cihaz testi ayrıca gerekir.
- Herkese açık çıktıda yalnızca kapak, hero, film adı/kimliği ve güncelleme özeti bulunur. Kurulum bağlantısı, API anahtarı ve profil yapılandırması yayınlanmaz. Hata çıktıları kaynak URL'lerini yazdırmaz.

## Yerel geliştirme

Node.js 24 ve sistemde DejaVu Sans fontu gerekir. `npm ci --ignore-scripts`, `npm test`, ardından yerel ortamda `XPERIENCE_MANIFEST_URL` ayarlanıp `npm run build` çalıştırılır. Gizli değeri terminal geçmişine yazmayın. `dist/` Pages dağıtımıdır; yalnızca başarılı üretim sonunda yenilenir.

## Görsel kaynakları

Görseller ilgili yapımların hak sahiplerine aittir. Bu ürün TMDB API'sini kullanan Xperience kataloglarından yararlanır; TMDB tarafından onaylanmış veya sertifikalandırılmış değildir. [TMDB](https://www.themoviedb.org/)

Bu sistem yayın bağlantısı veya izlenebilirlik doğrulamaz; Xperience'ın dijital yayın filtresi gerçek oynatma bağlantısını garanti etmez.
