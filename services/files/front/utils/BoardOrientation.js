const BOARD_SIZE = 10;

/**
 * Orientation du plateau à l'écran.
 *
 * Jouer les noirs revient à s'asseoir de l'autre côté de la table : le plateau
 * n'est pas miroité, il est tourné de 180°. La case logique (r, c) s'affiche
 * donc en (9-r, 9-c).
 *
 * Différence importante avec les échecs : ici les pièces ont une orientation.
 * Elles doivent donc tourner AVEC le plateau — un triangle qui renvoie le
 * faisceau vers le nord doit apparaître le renvoyant vers le sud. Sinon les
 * miroirs contrediraient visuellement le trajet du laser, et le joueur ne
 * pourrait plus prévoir un rebond. C'est ce qui rend la rotation du contexte
 * canvas non seulement pratique mais correcte.
 *
 * Une rotation de 180° est sa propre réciproque : la même fonction convertit
 * dans les deux sens. C'est volontaire, ça supprime la possibilité d'appliquer
 * la conversion à l'envers.
 */
export class BoardOrientation {

    constructor(flipped = false) {
        this.flipped = flipped;
    }

    /** Coordonnées logiques (celles du serveur) vers coordonnées écran. */
    toScreen(row, col) {
        return this.flipped
            ? { row: BOARD_SIZE - 1 - row, col: BOARD_SIZE - 1 - col }
            : { row, col };
    }

    /** Coordonnées écran (un clic) vers coordonnées logiques. */
    toLogical(row, col) {
        return this.toScreen(row, col);
    }

    /**
     * Installe l'orientation sur un contexte 2D. Tout ce qui sera dessiné
     * ensuite est tourné, y compris les animations, sans qu'aucun appel de
     * dessin n'ait à connaître l'orientation.
     *
     * La transformation survit aux couples save()/restore() des renderers,
     * mais PAS à une réaffectation de canvas.width : il faut la réinstaller
     * après chaque redimensionnement.
     */
    applyTo(ctx, boardSize) {
        if (this.flipped) ctx.setTransform(-1, 0, 0, -1, boardSize, boardSize);
        else ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
}
