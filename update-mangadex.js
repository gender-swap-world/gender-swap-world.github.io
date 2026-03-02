const fs = require('fs');
const axios = require('axios');

const API_URL = 'https://api.mangadex.org';

async function getMangaByTag(tagId, lang = 'vi') {
    const params = new URLSearchParams({
        includedTags: tagId,
        availableTranslatedLanguage: [lang],
        limit: 100,
        includes: ['cover_art', 'manga'],
        order: { createdAt: 'desc' }
    });

    const response = await axios.get(`${API_URL}/manga?${params}`);
    return response.data.data;
}

async function getChaptersForManga(mangaId, lang = 'vi') {
    const params = new URLSearchParams({
        manga: mangaId,
        translatedLanguage: [lang],
        limit: 500,
        order: { chapter: 'asc' }
    });

    const response = await axios.get(`${API_URL}/chapter?${params}`);
    return response.data.data;
}

function convertMangaToComic(manga, chapters) {
    const attrs = manga.attributes;
    const coverRel = manga.relationships.find(rel => rel.type === 'cover_art');
    const coverFileName = coverRel ? coverRel.attributes.fileName : null;
    const coverUrl = coverFileName
        ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.256.jpg`
        : 'https://placehold.co/300x400/444/ccc?text=No+Image';

    const mdChapters = chapters.map((ch, index) => ({
        id: index + 1,
        name: `Chapter ${ch.attributes.chapter || index + 1}: ${ch.attributes.title || ''}`,
        pages: [`https://mangadex.org/chapter/${ch.id}`] // Không thể lấy ảnh trực tiếp từ MangaDex qua frontend
    }));

    return {
        id: `md_${manga.id}`,
        title: attrs.title?.['vi'] || attrs.title?.['en'] || 'Unknown',
        desc: attrs.description?.['vi'] || attrs.description?.['en'] || 'Chưa có mô tả.',
        cover: coverUrl,
        chapters: mdChapters
    };
}

async function updateDataJson() {
    const dataFilePath = './data.json';
    let existingData = { comics: [] };

    if (fs.existsSync(dataFilePath)) {
        existingData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    }

    // Tag ID for "Gender Bender" (you can look it up in MangaDex API)
    const GENDER_SWAP_TAG_ID = 'df4de92c-07ea-4af0-b794-2f7d9ec2acdb'; // Gender Swap

    console.log('Fetching manga from MangaDex...');
    const mangas = await getMangaByTag(GENDER_SWAP_TAG_ID, 'vi');

    for (const manga of mangas) {
        const chapters = await getChaptersForManga(manga.id, 'vi');
        const comic = convertMangaToComic(manga, chapters);

        const existingIndex = existingData.comics.findIndex(c => c.id === comic.id);
        if (existingIndex !== -1) {
            // Update only if there are new chapters
            const existingChapters = existingData.comics[existingIndex].chapters;
            if (chapters.length > existingChapters.length) {
                existingData.comics[existingIndex] = comic;
                console.log(`Updated ${comic.title} with new chapters.`);
            }
        } else {
            existingData.comics.push(comic);
            console.log(`Added new manga: ${comic.title}`);
        }
    }

    fs.writeFileSync(dataFilePath, JSON.stringify(existingData, null, 2));
    console.log('data.json updated.');
}

if (require.main === module) {
    updateDataJson().catch(console.error);
}

module.exports = { updateDataJson };
