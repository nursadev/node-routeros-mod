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
export declare class CommandBuilder {
    private command;
    private words;
    /**
     * @param command Path menu RouterOS
     * Contoh:
     *  '/ppp/secret/print'
     *  '/ip/firewall/mangle/add'
     */
    constructor(command: string);
    /**
     * Menambahkan attribute parameter.
     * Digunakan untuk perintah add / set.
     *
     * Contoh:
     *  =name=username
     *  =password=123456
     */
    param(key: string, value: string | number | boolean): this;
    /**
     * Menambahkan ID target.
     * Digunakan saat melakukan update berdasarkan .id
     *
     * Contoh:
     *  =.id=*1A
     */
    id(id: string): this;
    /**
     * Equality filter (where key == value)
     *
     * Contoh:
     *  ?=name=user1
     */
    where(key: string, value: string | number | boolean): this;
    /**
     * Regex filter (like / contains)
     *
     * Contoh:
     *  ?name~user
     */
    whereLike(key: string, value: string): this;
    /**
     * Memilih field tertentu (.proplist)
     * Mirip SELECT kolom tertentu di SQL
     *
     * Contoh:
     *  =.proplist=.id,name
     */
    select(...fields: string[]): this;
    /**
     * Menghasilkan array command final
     * yang siap dikirim ke RouterOS Binary API
     */
    build(): string[];
}
