import * as emotes from "../mocks/emotes.js";
import * as profile_pictures from "../mocks/profile-picture.js";
import * as themes from "../mocks/themes.js";

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:8010";

export function get_shop_items() {
    return { emotes, profile_pictures, themes }
}

export function getDailyItems() {
    // [..
    let mergedList = [emotes.patrick_emotes, themes.bizot_and_deyann, themes.red_and_blue_theme, emotes.deyann_emotes, profile_pictures.benjamin_vella];
    return mergedList;
}

export async function purchase(item_index, userId) {

    const result = await fetch(`${USER_SERVICE_URL}/api/user/info/${userId}`);
    const user = await result.json();

    const user_inventory = [...user.emotes, ...user.profile_picture_list, ...user.themes];

    let mergedList = [...themes.themes, ...emotes.emotes, ...profile_pictures.profile_pictures];

    let item = mergedList.find(e => e.id === item_index);

    if (user_inventory.includes(item)) {
        throw new Error("Cannot buy an item twice");
    }

    if (user.snell_coins >= getTotalPrice(item)) {

        const res = await fetch(`${USER_SERVICE_URL}/api/user/inventory/add-purchased-item`, {
            method: "POST",
            body: JSON.stringify({ userId, item: item }),
            headers: { "Content-Type": "application/json", }
        })

        if (!res.ok) {
            throw new Error("Failed to purchase Item");
        }

    } else {
        throw new Error("You don't have enought snell coins to purchase this item");
    }

}

function getTotalPrice(item) {

    let total_price = 0

    item.content.forEach((it) => {
        total_price += it.unit_price
    });

    return total_price;
}