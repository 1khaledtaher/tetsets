import { showToast } from './ui.js';
import { getCurrentUser } from './auth.js';
import { saveFavoritesToDB } from './api.js';

export let favorites = [];

export function saveFavorites() {
    const user = getCurrentUser();
    if (user) {
        saveFavoritesToDB(user.uid, favorites);
    } else {
        localStorage.setItem('fav_guest', JSON.stringify(favorites));
    }
    document.dispatchEvent(new CustomEvent('favoritesUpdated'));
}

export function clearUserFavorites() {
    favorites = [];
    saveFavorites();
}

export function updateFavoritesOnLoad(userFavorites) {
    favorites = userFavorites;
    document.dispatchEvent(new CustomEvent('favoritesUpdated'));
}

export function toggleFavorite(productId, showToastFlag = true) {
    const index = favorites.indexOf(productId);
    if (index > -1) {
        favorites.splice(index, 1);
        if (showToastFlag) showToast('تمت الإزالة من المفضلة', 'info');
    } else {
        favorites.push(productId);
        if (showToastFlag) showToast('تمت الإضافة إلى المفضلة', 'success');
    }
    saveFavorites();
    document.dispatchEvent(new Event('favoritesUpdated'));
}