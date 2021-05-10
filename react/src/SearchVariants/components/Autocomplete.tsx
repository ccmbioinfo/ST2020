import React, { useState } from "react";
import { CircularProgress, OutlinedInput, useTheme } from "@material-ui/core";
import { Search } from "@material-ui/icons";
import { Autocomplete } from "@material-ui/lab";
import { useGenesQuery } from "../../hooks/genes";
import { Gene } from "../../typings";

interface GeneAutocompleteProps {
    fullWidth?: boolean;
    onSearch?: () => void;
    onSelect: (result: Gene) => void;
}

const GeneAutocomplete: React.FC<GeneAutocompleteProps> = ({ fullWidth, onSearch, onSelect }) => {
    const [search, setSearch] = useState<string>("");
    const [selectedValue, setSelectedValue] = useState<Gene>();

    const { data: results, isFetching } = useGenesQuery(
        {
            search,
        },
        search.length > 2
    );

    const theme = useTheme();

    return (
        <Autocomplete
            autoComplete
            clearOnEscape
            fullWidth={fullWidth}
            getOptionSelected={(option, value) => option.gene_id === value.gene_id}
            getOptionLabel={option => option?.hgnc_gene_name || ""}
            includeInputInList={true}
            inputValue={search}
            loading={isFetching}
            noOptionsText="No Results"
            options={results?.data.filter(d => !!d.hgnc_gene_name) || []}
            onInputChange={(event, newInputValue, reason) => {
                if (reason === "reset") {
                    setSearch("");
                } else if (reason === "input") {
                    setSearch(newInputValue);
                    if (onSearch) {
                        onSearch();
                    }
                }
            }}
            onChange={(
                event: React.ChangeEvent<{}>,
                selectedValue: Gene | null,
                reason: string
            ) => {
                if (search && reason !== "clear" && selectedValue) {
                    onSelect(selectedValue);
                    //persisting selected value will lead to option mismatch warnings
                    setSelectedValue(undefined);
                }
            }}
            renderInput={params => {
                const { InputLabelProps, InputProps, ...rest } = params;
                return (
                    <OutlinedInput
                        placeholder="Search by gene identifier"
                        {...rest}
                        {...InputProps}
                        startAdornment={
                            <Search fontSize="small" htmlColor={theme.palette.grey[600]} />
                        }
                        endAdornment={isFetching ? <CircularProgress size={16} /> : null}
                    />
                );
            }}
            //we have to control component in order to *prevent* selection persistence
            value={selectedValue || null}
        />
    );
};

export default GeneAutocomplete;
