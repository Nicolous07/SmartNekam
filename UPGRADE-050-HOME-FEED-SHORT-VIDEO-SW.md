# SmartNekam — Video fupi kwenye Home Feed

## Kilichoongezwa
- Composer ya Home Feed inaruhusu video za MP4, WebM, MOV/QuickTime, 3GPP na M4V pamoja na aina za faili zilizokuwepo.
- Kila faili lina kikomo cha **10 MB**; post moja bado inaweza kuwa na hadi **viambatisho 5**.
- Video iliyochapishwa inachezwa ndani ya Home Feed kwa HTML video player, ikiwa na controls za play/pause na sauti. Mtumiaji anaweza pia kuipakua.
- Preview ya video inaonekana kabla ya kuchapisha.
- Uthibitishaji wa aina ya faili na ukubwa hufanyika kabla ya ku-upload.

## Hatua ya Supabase inayohitajika
Endesha faili `sql/050_smartnekam_home_feed_short_video.sql` kwenye **Supabase → SQL Editor**. SQL 018 iliweka bucket `post-attachments` kwa picha na nyaraka pekee; migration hii inaongeza MIME types za video huku ikihifadhi kikomo cha 10 MB.

Baada ya SQL kufanikiwa na deployment ya Vercel kukamilika, fungua Home → Home Feed → Chapisha post. Sehemu ya media ina chaguo tatu: **Piga picha** (kamera ya ukurasa au kamera ya kifaa), **Rekodi video** (kamera ya ukurasa au kamera ya kifaa), na **Kutoka kwenye kifaa** (upload ya kawaida). Ruhusu kamera/microphone browser ikikuomba; kamera ya ndani ya ukurasa inahitaji HTTPS. Video inayorekodiwa kwenye ukurasa husimama baada ya sekunde 30 au inapofikia kikomo cha 10 MB. Ikiwa kamera haiwezi kufunguka, tumia chaguo la kamera ya kifaa au upload. Kisha chapisha pamoja na maelezo ya post (angalau herufi 3).

Hakuna SQL mpya ya jedwali la posts inayohitajika ikiwa SQL 018 tayari imeendeshwa, kwa sababu attachment metadata huhifadhiwa kwenye `posts.attachments` iliyopo.
