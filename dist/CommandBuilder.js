"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandBuilder = void 0;
/**
 * CommandBuilder untuk RouterOS Binary API (ROS6 & ROS7)
 *
 * Digunakan untuk membangun command dalam format Word-based protocol
 * yang digunakan oleh MikroTik RouterOS Binary API (port 8728 / 8729).
 *
 * RouterOS Binary API TIDAK menggunakan string CLI seperti:
 *   "/ppp/secret/print where name=xxx"
 *
 * Tetapi menggunakan format word array seperti:
 *   [
 *     "/ppp/secret/print",
 *     "?=name=xxx",
 *     "=.proplist=.id"
 *   ]
 *
 * Prefix yang digunakan:
 *
 * =key=value     → Attribute (digunakan saat add / set)
 * =.id=*XX       → Target ID untuk update
 * ?=key=value    → Equality filter (where key == value)
 * ?key~value     → Regex filter (like / contains)
 * =.proplist=... → Select field tertentu (mirip SELECT di SQL)
 *
 * Contoh penggunaan:
 *
 * new CommandBuilder('/ppp/secret/print')
 *   .where('name', 'user1')
 *   .select('.id')
 *   .build();
 *
 * Output:
 * [
 *   '/ppp/secret/print',
 *   '?=name=user1',
 *   '=.proplist=.id'
 * ]
 *
 * Class ini bersifat chainable.
 */
class CommandBuilder {
    /**
     * @param command Path menu RouterOS
     * Contoh:
     *  '/ppp/secret/print'
     *  '/ip/firewall/mangle/add'
     */
    constructor(command) {
        this.words = [];
        this.command = command;
    }
    /**
     * Menambahkan attribute parameter.
     * Digunakan untuk perintah add / set.
     *
     * Contoh:
     *  =name=username
     *  =password=123456
     */
    param(key, value) {
        this.words.push(`=${key}=${value}`);
        return this;
    }
    /**
     * Menambahkan ID target.
     * Digunakan saat melakukan update berdasarkan .id
     *
     * Contoh:
     *  =.id=*1A
     */
    id(id) {
        this.words.push(`=.id=${id}`);
        return this;
    }
    /**
     * Equality filter (where key == value)
     *
     * Contoh:
     *  ?=name=user1
     */
    where(key, value) {
        this.words.push(`?=${key}=${value}`);
        return this;
    }
    /**
     * Regex filter (like / contains)
     *
     * Contoh:
     *  ?name~user
     */
    whereLike(key, value) {
        this.words.push(`?${key}~${value}`);
        return this;
    }
    /**
     * Memilih field tertentu (.proplist)
     * Mirip SELECT kolom tertentu di SQL
     *
     * Contoh:
     *  =.proplist=.id,name
     */
    select(...fields) {
        this.words.push(`=.proplist=${fields.join(',')}`);
        return this;
    }
    /**
     * Menghasilkan array command final
     * yang siap dikirim ke RouterOS Binary API
     */
    build() {
        return [this.command, ...this.words];
    }
}
exports.CommandBuilder = CommandBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29tbWFuZEJ1aWxkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbWFuZEJ1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXVDRztBQUNILE1BQWEsY0FBYztJQUl2Qjs7Ozs7T0FLRztJQUNILFlBQVksT0FBZTtRQVJuQixVQUFLLEdBQWEsRUFBRSxDQUFDO1FBU3pCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0lBQzNCLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsS0FBSyxDQUFDLEdBQVcsRUFBRSxLQUFnQztRQUMvQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ3BDLE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSCxFQUFFLENBQUMsRUFBVTtRQUNULElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM5QixPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxLQUFLLENBQUMsR0FBVyxFQUFFLEtBQWdDO1FBQy9DLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDckMsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsU0FBUyxDQUFDLEdBQVcsRUFBRSxLQUFhO1FBQ2hDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDcEMsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILE1BQU0sQ0FBQyxHQUFHLE1BQWdCO1FBQ3RCLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGNBQWMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbEQsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUs7UUFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN6QyxDQUFDO0NBQ0o7QUFoRkQsd0NBZ0ZDIn0=